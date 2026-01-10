import type { ExportedJSON } from "@/ledger/type";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { getAccountMeta, queryBills } from "./functions";
import { requestAI } from "./request";
import { systemPrompt } from "./system-prompt";

const DEBUG = import.meta.env.DEV === true;

interface ParsedResponse {
    title?: string;
    thought?: string;
    toolCall?: {
        function: string;
        arguments: Record<string, any>;
    } | null;
    content: string; // 除去标签后的纯文本回答
    raw: string; // 原始字符串
}

/**
 * 健壮的 XML 标签解析器 (Loose Parsing)
 * 即使缺少闭合标签或格式稍有偏差也能尝试提取
 */
/**
 * 增强后的解析器：支持 Answer 标签的提取与清洗
 */
function parseStandardResponse(response: string): ParsedResponse {
    const extractTag = (tag: string, input: string) => {
        // 匹配 <Tag>内容</Tag> 或 <Tag>内容 (支持未闭合情况)
        const regex = new RegExp(`<${tag}>([\\s\\S]*?)(?:<\\/${tag}>|$)`, "i");
        const match = input.match(regex);
        return match ? match[1].trim() : undefined;
    };

    const title = extractTag("TITLE", response);
    const thought = extractTag("Thought", response);
    const toolRaw = extractTag("Tool", response);
    const answerTagContent = extractTag("Answer", response); // 新增：提取 Answer 标签内容

    let toolCall = null;
    if (toolRaw) {
        toolCall = parseToolContent(toolRaw);
    }

    // 清洗逻辑：移除所有 XML 块，包括 Answer
    const cleanedRemainder = response
        .replace(/<TITLE>[\s\S]*?(?:<\/TITLE>|$)/gi, "")
        .replace(/<Thought>[\s\S]*?(?:<\/Thought>|$)/gi, "")
        .replace(/<Tool>[\s\S]*?(?:<\/Tool>|$)/gi, "")
        .replace(/<Answer>[\s\S]*?(?:<\/Answer>|$)/gi, "") // 新增：移除 Answer 标记及其内部内容
        .trim();

    // 最终显示内容的优先级：
    // 1. 如果有 <Answer> 标签，优先使用标签内的内容
    // 2. 如果没有 <Answer> 标签，则使用移除所有标签后的剩余文本
    const content = answerTagContent || cleanedRemainder;

    return {
        title,
        thought,
        toolCall,
        content,
        raw: response,
    };
}

/**
 * 解析 Tool 内部的 key=value 格式
 */
function parseToolContent(content: string) {
    const lines = content
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    const args: Record<string, any> = {};
    let functionName = "";

    for (const line of lines) {
        const parts = line.split("=");
        if (parts.length < 2) continue;
        const key = parts[0].trim();
        const value = parts
            .slice(1)
            .join("=")
            .trim()
            .replace(/^["']|["']$/g, "");

        if (key === "function") {
            functionName = value;
        } else {
            // 简单类型转换
            if (value.includes(",")) {
                args[key] = value.split(",").map((v) => v.trim());
            } else if (/^\d+(\.\d+)?$/.test(value)) {
                args[key] = Number(value);
            } else if (
                value.toLowerCase() === "true" ||
                value.toLowerCase() === "false"
            ) {
                args[key] = value.toLowerCase() === "true";
            } else {
                args[key] = value;
            }
        }
    }
    return functionName ? { function: functionName, arguments: args } : null;
}

/**
 * 执行函数调用 (保持原有逻辑，稍作导出封装)
 */
async function executeFunctionCall(
    call: { function: string; arguments: Record<string, any> },
    ledgerData: ExportedJSON,
): Promise<any> {
    const { function: name, arguments: args } = call;
    if (DEBUG) console.log("[Chat Debug] 执行工具:", name, args);

    switch (name) {
        case "query_bills": {
            const result = queryBills(args as any, ledgerData);
            return {
                bills: result.bills.map((b) => ({
                    ...b,
                    amount: b.amount / 10000,
                })),
                statistics: {
                    totalIncome: result.statistics.totalIncome / 10000,
                    totalExpense: result.statistics.totalExpense / 10000,
                },
            };
        }
        case "get_account_meta":
            return getAccountMeta(ledgerData.meta);
        default:
            throw new Error(`未知工具: ${name}`);
    }
}

/**
 * 修改后的 createChatBox
 */
export const createChatBox = async (
    envPrompt: string,
    prevMessages?: any[],
) => {
    const store = useLedgerStore.getState();
    const bills = await store.refreshBillList();
    const ledgerData: ExportedJSON = { items: bills, meta: store.infos!.meta };

    const conversationHistory = prevMessages ?? [];
    const functionResults: Array<{ function: string; result: any }> = [];

    /**
     * next 函数现在返回一个结构化对象
     */
    const next = async (message: string): Promise<ParsedResponse> => {
        conversationHistory.push({ role: "user", content: message });

        let iterations = 0;
        const maxIterations = 5;

        while (iterations < maxIterations) {
            iterations++;

            // 构建上下文 (复用你原有的 buildMessages 逻辑)
            const messages = [
                { role: "system", content: `${systemPrompt}\n\n${envPrompt}` },
                ...conversationHistory,
                ...(functionResults.length > 0
                    ? [
                          {
                              role: "user",
                              content: `## ${t("ai-function-toll-result")}\n${JSON.stringify(functionResults.slice(-1))}`,
                          },
                      ]
                    : []),
            ];

            const aiRawResponse = await requestAI(messages as any);
            const parsed = parseStandardResponse(aiRawResponse);

            if (DEBUG) console.log(`[Chat Iteration ${iterations}]`, parsed);

            // 如果包含工具调用，则执行并进入下一轮循环
            if (parsed.toolCall) {
                try {
                    const result = await executeFunctionCall(
                        parsed.toolCall,
                        ledgerData,
                    );
                    functionResults.push({
                        function: parsed.toolCall.function,
                        result,
                    });

                    // 将 AI 的思考过程存入历史，以便下一轮引用
                    conversationHistory.push({
                        role: "assistant",
                        content: aiRawResponse,
                    });
                } catch (error) {
                    const errorMsg = `工具调用失败: ${error}`;
                    conversationHistory.push({
                        role: "assistant",
                        content: errorMsg,
                    });
                    return { ...parsed, content: errorMsg };
                }
            } else {
                // 没有工具调用，这是最终回答
                conversationHistory.push({
                    role: "assistant",
                    content: aiRawResponse,
                });
                return parsed;
            }
        }

        return {
            content: "由于对话轮次过多，分析已中止。",
            raw: "",
            title: "分析中断",
        };
    };

    return { next };
};

export type ChatBox = Awaited<ReturnType<typeof createChatBox>>;

export interface Message {
    role: "user" | "assistant";
    content: string;
}
