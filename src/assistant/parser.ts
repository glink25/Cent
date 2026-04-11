/** biome-ignore-all lint/suspicious/noAssignInExpressions: regex exec loop pattern */
import { jsonrepair } from "jsonrepair";
import type {
    AssistantMessage,
    ProviderRequestChunk,
    Skill,
    ToolMessage,
} from "./type";

export type ToolCall = {
    name: string;
    params: unknown;
    raw: string;
};

export function parseResult(result: ProviderRequestChunk): AssistantMessage {
    const assistantMsg: AssistantMessage = {
        role: "assistant",
        raw: result.answer,
        formatted: {
            thought: result.thought || "",
            answer: "",
            overview: "",
        },
    };

    let remainingText = result.answer;

    // 辅助函数：解析任意标签内容并追加到指定字段
    function extractTag(
        tag: string,
        field: keyof AssistantMessage["formatted"],
    ) {
        const regex = new RegExp(
            `<${tag}>([\\s\\S]*?)(?:<\\/${tag}>|<\\/${tag}|(?=<${tag})|$)`,
            "gi",
        );
        remainingText = remainingText.replace(regex, (match, content) => {
            const cleanContent = (content || "").replace(/[<>]/g, "").trim();
            if (cleanContent) {
                assistantMsg.formatted[field] += cleanContent;
            }
            return ""; // 从 remainingText 中移除匹配部分
        });
    }

    // 1. 解析 <overview>
    extractTag("overview", "overview");

    // 2. 解析 <thought>
    extractTag("thought", "thought");

    // 3. 解析 <tool>
    const toolRegex = /<tool>([\s\S]*?)(?:(<\s*\/?\s*tool[^>]*>?)|(?=<))/gi;
    remainingText = remainingText.replace(toolRegex, (match, content) => {
        if (!content) return "";
        const cleanContent = content.replace(/[<>]/g, "").trim();

        if (cleanContent) {
            try {
                const repairedJson = jsonrepair(cleanContent);
                const parsedTool = JSON.parse(repairedJson);

                if (!assistantMsg.formatted.tools) {
                    assistantMsg.formatted.tools = [];
                }
                assistantMsg.formatted.tools.push({
                    name: parsedTool.name || "unknown_tool",
                    params: parsedTool.params || {},
                });
            } catch (e) {
                console.error(
                    "JSON Repair/Parse failed:",
                    e,
                    "Content:",
                    cleanContent,
                );
            }
        }

        return "";
    });

    // 4. 清理剩余文本作为 answer
    assistantMsg.formatted.answer = remainingText
        .replace(/\n{2,}/g, "\n")
        .replace(/<\s*\/\s*$/g, "")
        .trim();

    return assistantMsg;
}
/**
 * 快速解析 skill.md 的元数据
 * @param {string} mdContent - Markdown 文本内容
 * @returns {object} { name, description }
 */
export function parseSkillMetadata(mdContent: string): Skill {
    // 匹配开头 --- 包围的区域
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*/;
    const match = mdContent.match(frontmatterRegex);

    if (!match) {
        throw new Error(
            `can not parse markdown as Skill: ${mdContent.slice(10)}...`,
        );
    }

    const yamlBlock = match[1];

    // 提取具体字段
    const getName = (block: string) =>
        block.match(/^name:\s*(.*)$/m)?.[1]?.trim() || "";
    const getDesc = (block: string) =>
        block.match(/^description:\s*(.*)$/m)?.[1]?.trim() || "";

    const name = getName(yamlBlock);
    return {
        id: name || "unknown-skill",
        name,
        description: getDesc(yamlBlock),
        content: mdContent,
    };
}
