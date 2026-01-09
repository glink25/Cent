import dayjs from "dayjs";
import { BillCategories } from "@/ledger/category";
import type { BillFilterView } from "@/ledger/extra-type";
import type { ExportedJSON } from "@/ledger/type";
import { useLedgerStore } from "@/store/ledger";
import type { ViewType } from "../stat/date-slice";
import type { FocusType } from "../stat/focus-type";
import { getAccountMeta, queryBills } from "./functions";
import { requestAI } from "./request";
import { systemPrompt } from "./system-prompt";

// Debug 标志：设置为 true 时在控制台打印对话信息和函数调用情况
const DEBUG = true;

/**
 * 解析 AI 响应中的函数调用
 * 支持格式：<Tool>key=value key2=value2</Tool>
 */
function parseFunctionCall(response: string): {
    function: string;
    arguments: Record<string, unknown>;
} | null {
    // 匹配 <Tool>...</Tool> 格式
    const toolBlockMatch = response.match(/<Tool>([\s\S]*?)<\/Tool>/i);
    if (toolBlockMatch) {
        try {
            const content = toolBlockMatch[1].trim();
            const lines = content
                .split(/\r?\n/)
                .map((line) => line.trim())
                .filter((line) => line);

            const args: Record<string, unknown> = {};
            let functionName: string | null = null;

            for (const line of lines) {
                // 匹配 key=value 格式
                const match = line.match(/^([^=]+)=(.*)$/);
                if (match) {
                    const key = match[1].trim();
                    let value: string = match[2].trim();

                    // 移除可能的引号
                    if (
                        (value.startsWith('"') && value.endsWith('"')) ||
                        (value.startsWith("'") && value.endsWith("'"))
                    ) {
                        value = value.slice(1, -1);
                    }

                    if (key === "function") {
                        functionName = value;
                    } else {
                        // 尝试解析值类型
                        // 1. 数组（逗号分隔）
                        if (value.includes(",")) {
                            args[key] = value
                                .split(",")
                                .map((v) => v.trim())
                                .filter((v) => v);
                        }
                        // 2. 数字
                        else if (/^-?\d+(\.\d+)?$/.test(value)) {
                            args[key] = value.includes(".")
                                ? parseFloat(value)
                                : parseInt(value, 10);
                        }
                        // 3. 布尔值
                        else if (
                            value.toLowerCase() === "true" ||
                            value.toLowerCase() === "false"
                        ) {
                            args[key] = value.toLowerCase() === "true";
                        }
                        // 4. 字符串
                        else {
                            args[key] = value;
                        }
                    }
                }
            }

            if (functionName) {
                const functionCall = {
                    function: functionName,
                    arguments: args,
                };
                if (DEBUG) {
                    console.log("[Chat Debug] 解析到函数调用:", functionCall);
                }
                return functionCall;
            }
        } catch {
            // 忽略解析错误
        }
    }

    return null;
}

/**
 * 执行函数调用
 */
async function executeFunctionCall(
    functionName: string,
    args: Record<string, unknown>,
    data: ExportedJSON,
): Promise<unknown> {
    if (DEBUG) {
        console.log("[Chat Debug] 执行函数调用:", {
            function: functionName,
            arguments: args,
        });
    }
    switch (functionName) {
        case "query_bills": {
            const result = queryBills(
                args as Parameters<typeof queryBills>[0],
                data,
            );
            // 将金额从 Amount 类型（10000:1）转换为元
            const transformedResult = {
                bills: result.bills.map((bill) => ({
                    ...bill,
                    amount: bill.amount / 10000, // 转换为元
                    time: new Date(bill.time).toISOString().split("T")[0], // 转换为日期字符串
                })),
                statistics: {
                    ...result.statistics,
                    totalIncome: result.statistics.totalIncome / 10000,
                    totalExpense: result.statistics.totalExpense / 10000,
                    netAmount: result.statistics.netAmount / 10000,
                },
            };
            if (DEBUG) {
                console.log("[Chat Debug] 函数调用结果 (query_bills):", {
                    billsCount: transformedResult.bills.length,
                    statistics: transformedResult.statistics,
                });
            }
            return transformedResult;
        }
        case "get_account_meta": {
            const result = getAccountMeta(data.meta);
            if (DEBUG) {
                console.log(
                    "[Chat Debug] 函数调用结果 (get_account_meta):",
                    result,
                );
            }
            return result;
        }
        default:
            throw new Error(`Unknown function: ${functionName}`);
    }
}

/**
 * 获取账本数据
 */
async function getLedgerData(): Promise<ExportedJSON> {
    const store = useLedgerStore.getState();

    // 确保获取所有账单数据
    const bills = await store.refreshBillList();
    const meta = store.infos?.meta;

    if (!meta) {
        throw new Error("Ledger meta not found");
    }

    return {
        items: bills,
        meta,
    };
}

/**
 * 构建完整的对话上下文
 * 返回结构化的消息列表，用于 API 调用
 */
function buildMessages(
    systemPrompt: string,
    conversationHistory: Array<{ role: "user" | "assistant"; content: string }>,
    functionResults?: Array<{ function: string; result: unknown }>,
    envPrompt?: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }> = [];

    // 合并系统提示词和环境提示
    let fullSystemPrompt = systemPrompt;
    if (envPrompt) {
        fullSystemPrompt = `${systemPrompt}\n\n${envPrompt}`;
    }

    // 添加系统提示词
    messages.push({
        role: "system",
        content: fullSystemPrompt,
    });

    // 添加对话历史
    for (const message of conversationHistory) {
        // 将本地的 role 转换为 API 需要的 role
        if (message.role === "user") {
            messages.push({
                role: "user",
                content: message.content,
            });
        } else {
            messages.push({
                role: "assistant",
                content: message.content,
            });
        }
    }

    // 如果有函数调用结果，将其作为用户消息添加到上下文中
    // 这样 AI 可以看到函数调用的结果
    if (functionResults && functionResults.length > 0) {
        let functionResultsText = "## 函数调用结果\n\n";
        for (const { function: funcName, result } of functionResults) {
            functionResultsText += `函数 ${funcName} 的返回结果：\n${JSON.stringify(result, null, 2)}\n\n`;
        }
        messages.push({
            role: "user",
            content: functionResultsText,
        });
    }

    if (DEBUG) {
        console.log("[Chat Debug] 构建的消息列表:", {
            totalMessages: messages.length,
            messages: messages.map((msg) => ({
                role: msg.role,
                contentLength: msg.content.length,
                contentPreview:
                    msg.content.substring(0, 100) +
                    (msg.content.length > 100 ? "..." : ""),
            })),
        });
    }

    return messages;
}

export interface Message {
    role: "user" | "assistant";
    content: string;
}

/**
 * 开始对话，输入初始消息，返回一个next函数，能够自动合并上下文，并返回AI的响应结果
 *
 * 实现 Agent 模式：
 * 1. 用户发送消息
 * 2. 构建上下文并发送给 AI
 * 3. 解析 AI 响应，检查是否有函数调用
 * 4. 如果有函数调用，执行函数并将结果返回给 AI
 * 5. 重复步骤 2-4，直到 AI 给出最终回答（没有函数调用）
 *
 * @returns 返回一个 next 函数，用于发送消息并获取 AI 响应
 */
export const createChatBox = async (
    envPrompt: string,
    prevMessages?: Message[],
) => {
    // 获取账本数据（在对话开始时获取一次，后续复用）
    const ledgerData = await getLedgerData();

    // 对话历史
    const conversationHistory: Array<{
        role: "user" | "assistant";
        content: string;
    }> = prevMessages ?? [];

    // 函数调用结果历史
    const functionResults: Array<{ function: string; result: unknown }> = [];

    // 保存环境提示，用于后续构建消息
    const savedEnvPrompt = envPrompt;

    /**
     * 发送消息并获取 AI 响应
     * 支持多轮函数调用的 Agent 模式
     */
    const next = async (message: string): Promise<string> => {
        // 添加用户消息到历史
        conversationHistory.push({ role: "user", content: message });

        if (DEBUG) {
            console.log("[Chat Debug] ========== 新消息 ==========");
            console.log("[Chat Debug] 用户消息:", message);
            console.log(
                "[Chat Debug] 当前对话历史长度:",
                conversationHistory.length,
            );
        }

        // 最大循环次数，防止无限循环
        const maxIterations = 10;
        let iterations = 0;

        while (iterations < maxIterations) {
            iterations++;

            if (DEBUG) {
                console.log(
                    `[Chat Debug] --- 迭代 ${iterations}/${maxIterations} ---`,
                );
            }

            // 构建消息列表
            const messages = buildMessages(
                systemPrompt,
                conversationHistory,
                functionResults.length > 0 ? functionResults : undefined,
                savedEnvPrompt,
            );

            // 调用 AI
            const aiResponse = await requestAI(messages);

            if (DEBUG) {
                console.log("[Chat Debug] AI 响应:", aiResponse);
            }

            // 检查是否有函数调用
            const functionCall = parseFunctionCall(aiResponse);

            if (functionCall) {
                if (DEBUG) {
                    console.log("[Chat Debug] 检测到函数调用，准备执行...");
                }
                // 执行函数调用
                try {
                    const result = await executeFunctionCall(
                        functionCall.function,
                        functionCall.arguments,
                        ledgerData,
                    );

                    if (DEBUG) {
                        console.log("[Chat Debug] 函数调用执行成功");
                    }

                    // 保存函数调用结果（只保留最近的函数调用结果，避免上下文过长）
                    // 如果已经有结果，替换最后一个；否则添加新的
                    if (
                        functionResults.length > 0 &&
                        functionResults[functionResults.length - 1].function ===
                            functionCall.function
                    ) {
                        functionResults[functionResults.length - 1].result =
                            result;
                    } else {
                        functionResults.push({
                            function: functionCall.function,
                            result,
                        });
                    }

                    // 将函数调用信息添加到对话历史
                    // 如果最后一条消息是助手消息且包含函数调用，则更新它；否则添加新消息
                    const lastMessage =
                        conversationHistory[conversationHistory.length - 1];
                    if (
                        lastMessage &&
                        lastMessage.role === "assistant" &&
                        lastMessage.content.includes("调用函数")
                    ) {
                        // 更新最后一条消息，添加新的函数调用信息
                        lastMessage.content += `\n\n调用函数 ${functionCall.function} 完成。`;
                    } else {
                        // 添加新的助手消息
                        conversationHistory.push({
                            role: "assistant",
                            content: `正在调用函数 ${functionCall.function} 获取数据...`,
                        });
                    }
                } catch (error) {
                    // 函数调用失败，返回错误信息
                    const errorMessage = `函数调用失败：${error instanceof Error ? error.message : String(error)}`;
                    if (DEBUG) {
                        console.error("[Chat Debug] 函数调用失败:", error);
                    }
                    conversationHistory.push({
                        role: "assistant",
                        content: errorMessage,
                    });
                    return errorMessage;
                }
            } else {
                // 没有函数调用，AI 给出了最终回答
                if (DEBUG) {
                    console.log("[Chat Debug] AI 给出最终回答，无函数调用");
                }
                // 如果最后一条助手消息是函数调用提示，则替换它；否则添加新消息
                const lastMessage =
                    conversationHistory[conversationHistory.length - 1];
                if (
                    lastMessage &&
                    lastMessage.role === "assistant" &&
                    (lastMessage.content.includes("调用函数") ||
                        lastMessage.content.includes("正在调用"))
                ) {
                    // 替换最后一条消息为最终回答
                    lastMessage.content = aiResponse;
                } else {
                    // 添加新的助手消息
                    conversationHistory.push({
                        role: "assistant",
                        content: aiResponse,
                    });
                }
                if (DEBUG) {
                    console.log("[Chat Debug] ========== 对话结束 ==========");
                }
                return aiResponse;
            }
        }

        // 超过最大循环次数
        const errorMessage = "抱歉，处理您的请求时遇到了问题。请稍后再试。";
        if (DEBUG) {
            console.warn("[Chat Debug] 超过最大循环次数，终止对话");
        }
        conversationHistory.push({ role: "assistant", content: errorMessage });
        return errorMessage;
    };

    return { next };
};

export type ChatBox = Awaited<ReturnType<typeof createChatBox>>;

export type EnvArg = {
    filterView?: BillFilterView;
    focusType?: FocusType;
    viewType?: ViewType;
    range: number[];
};
export function getEnvPrompt(env?: EnvArg) {
    if (!env) {
        return "";
    }

    const store = useLedgerStore.getState();
    const meta = store.infos?.meta;
    const creators = store.infos?.creators ?? [];

    // 获取所有分类（默认分类 + 自定义分类）
    const allCategories = [...BillCategories, ...(meta?.categories ?? [])];

    // 获取所有标签
    const allTags = meta?.tags ?? [];

    const parts: string[] = [];

    // 基础信息
    parts.push("## 当前环境信息");
    parts.push("");
    parts.push(`**当前时间**: ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
    parts.push("");

    // 过滤视图信息
    if (env.filterView) {
        parts.push("### 当前选中的过滤视图");
        parts.push(`- **视图名称**: ${env.filterView.name}`);
        if (env.filterView.displayCurrency) {
            parts.push(`- **显示货币**: ${env.filterView.displayCurrency}`);
        }
        parts.push("");

        const filter = env.filterView.filter;

        // 时间范围
        if (filter.start || filter.end) {
            const startStr = filter.start
                ? dayjs(filter.start).format("YYYY-MM-DD")
                : "不限";
            const endStr = filter.end
                ? dayjs(filter.end).format("YYYY-MM-DD")
                : "不限";
            parts.push(`- **时间范围**: ${startStr} 至 ${endStr}`);
        }

        // 账单类型
        if (filter.type) {
            const typeName =
                filter.type === "income"
                    ? "收入"
                    : filter.type === "expense"
                      ? "支出"
                      : "全部";
            parts.push(`- **账单类型**: ${typeName}`);
        }

        // 分类
        if (filter.categories && filter.categories.length > 0) {
            const categoryNames = filter.categories
                .map((id) => allCategories.find((c) => c.id === id)?.name ?? id)
                .filter(Boolean);
            parts.push(`- **分类**: ${categoryNames.join("、")}`);
        }

        // 标签
        if (filter.tags && filter.tags.length > 0) {
            const tagNames = filter.tags
                .map((id) => allTags.find((t) => t.id === id)?.name ?? id)
                .filter(Boolean);
            parts.push(`- **包含标签**: ${tagNames.join("、")}`);
        }

        // 排除标签
        if (filter.excludeTags && filter.excludeTags.length > 0) {
            const excludeTagNames = filter.excludeTags
                .map((id) => allTags.find((t) => t.id === id)?.name ?? id)
                .filter(Boolean);
            parts.push(`- **排除标签**: ${excludeTagNames.join("、")}`);
        }

        // 创建者
        if (filter.creators && filter.creators.length > 0) {
            const creatorNames = filter.creators
                .map(
                    (id) =>
                        creators.find((c) => c.id === id)?.name ?? String(id),
                )
                .filter(Boolean);
            parts.push(`- **创建者**: ${creatorNames.join("、")}`);
        }

        // 金额范围
        if (filter.minAmountNumber !== undefined) {
            parts.push(
                `- **最小金额**: ${(filter.minAmountNumber / 10000).toFixed(2)} 元`,
            );
        }
        if (filter.maxAmountNumber !== undefined) {
            parts.push(
                `- **最大金额**: ${(filter.maxAmountNumber / 10000).toFixed(2)} 元`,
            );
        }

        // 其他过滤条件
        if (filter.comment) {
            parts.push(`- **关键词搜索**: ${filter.comment}`);
        }
        if (filter.assets !== undefined) {
            parts.push(`- **包含资产**: ${filter.assets ? "是" : "否"}`);
        }
        if (filter.scheduled !== undefined) {
            parts.push(`- **包含周期记账**: ${filter.scheduled ? "是" : "否"}`);
        }
        if (filter.currencies && filter.currencies.length > 0) {
            parts.push(`- **货币**: ${filter.currencies.join("、")}`);
        }

        parts.push("");
    }

    // 时间切片信息
    if (env.viewType) {
        parts.push("### 当前时间切片视图");
        const viewTypeNames: Record<ViewType, string> = {
            weekly: "周视图",
            monthly: "月视图",
            yearly: "年视图",
            custom: "自定义视图",
        };
        parts.push(
            `- **视图类型**: ${viewTypeNames[env.viewType] || env.viewType}`,
        );
        parts.push("");
    }

    // 当前选中的时间范围
    if (env.range && env.range.length === 2) {
        const [start, end] = env.range;
        const startStr = dayjs(start).format("YYYY-MM-DD");
        const endStr = dayjs(end).format("YYYY-MM-DD");
        parts.push("### 当前选中的时间范围");
        parts.push(`- **开始时间**: ${startStr}`);
        parts.push(`- **结束时间**: ${endStr}`);
        parts.push("");
    }

    // 焦点类型
    if (env.focusType) {
        parts.push("### 当前焦点类型");
        const focusTypeNames: Record<FocusType, string> = {
            income: "收入",
            expense: "支出",
            balance: "余额",
        };
        parts.push(
            `- **焦点类型**: ${focusTypeNames[env.focusType] || env.focusType}`,
        );
        parts.push("");
    }

    // 提示信息
    parts.push("---");
    parts.push("");
    parts.push(
        "以上信息可以帮助你更好地理解用户当前的上下文。当用户询问账单相关问题时，请考虑这些过滤条件和时间范围。",
    );

    return parts.join("\n");
}
