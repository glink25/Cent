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
    // 1. 初始化 AssistantMessage 基础结构
    const assistantMsg: AssistantMessage = {
        role: "assistant",
        raw: result.answer,
        formatted: {
            thought: result.thought,
            answer: "", // 后续填充非标签文本
            overview: "",
        },
    };

    let remainingText = result.answer;

    // 2. 解析 <overview> 标签
    const overviewRegex = /<overview>([\s\S]*?)<\/overview>/g;
    let overviewMatch: RegExpExecArray | null;
    while ((overviewMatch = overviewRegex.exec(result.answer)) !== null) {
        assistantMsg.formatted.overview += overviewMatch[1].trim();
        // 从剩余文本中移除已解析的标签，以便提取纯 answer
        remainingText = remainingText.replace(overviewMatch[0], "");
    }

    // 3. 解析 <tool> 标签并生成 ToolMessage
    const toolRegex = /<tool>([\s\S]*?)<\/tool>/g;
    let toolMatch: RegExpExecArray | null;
    while ((toolMatch = toolRegex.exec(result.answer)) !== null) {
        const rawToolContent = toolMatch[1].trim();
        remainingText = remainingText.replace(toolMatch[0], "");

        try {
            // 使用 jsonrepair 修复可能截断或格式错误的 JSON
            const repairedJson = jsonrepair(rawToolContent);
            const parsedTool = JSON.parse(repairedJson);
            if (!assistantMsg.formatted.tools) {
                assistantMsg.formatted.tools = [];
            }
            assistantMsg.formatted.tools.push({
                name: parsedTool.name || "unknown_tool",
                params: parsedTool.params || {},
            });
        } catch (e) {
            console.error("Failed to parse tool content even with repair:", e);
            // 如果彻底解析失败，可以选择跳过或作为普通文本处理
        }
    }

    // 4. 清理并填充剩余的 answer 文本
    assistantMsg.formatted.answer = remainingText
        .replace(/\n{2,}/g, "\n")
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
