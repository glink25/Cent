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
            thought: result.thought,
            answer: "",
            overview: "",
        },
    };

    let remainingText = result.answer;

    // 1. 解析 <overview> (同样应用宽松匹配)
    const overviewRegex =
        /<overview>([\s\S]*?)(?:<\/overview>|<\/overview|(?=<overview)|$)/gi;
    remainingText = remainingText.replace(overviewRegex, (match, content) => {
        assistantMsg.formatted.overview += (content || "").trim();
        return "";
    });

    // 2. 解析 <tool> 标签
    /**
     * 正则逻辑说明：
     * <tool>             : 匹配起始标签
     * ([\s\S]*?)         : 捕获组 1 (JSON内容)：非贪婪匹配
     * (?:                : 结束边界判断（非捕获组）：
     * (<\s*\/?\s*tool[^>]*>?) : 情况A：匹配到结束标签 </tool>、起始标签 <tool>、或缺失闭合的 </tool
     * |                : 或
     * (?=<)            : 情况B：预查到下一个尖括号 < 出现，但并不消耗它（交给下一个匹配周期）
     * )
     * * 注意：去掉了 $ (字符串末尾)，确保只有看到第二个 < 时才触发匹配成功
     */
    const toolRegex = /<tool>([\s\S]*?)(?:(<\s*\/?\s*tool[^>]*>?)|(?=<))/gi;

    // 使用 replace 的回调函数来提取内容，这样可以一次性完成提取和清理 remainingText
    remainingText = remainingText.replace(
        toolRegex,
        (match, content, closingTag) => {
            // 这里的 content 就是 > 和 < 之间的内容
            if (!content) return "";

            // 严格二次清洗：绝对不要包含任何尖括号（防止正则边缘情况）
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

            // 返回空字符串，表示将整个匹配到的部分（包括标签）从 answer 中移除
            return "";
        },
    );

    // 3. 清理剩余的文本作为 answer
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
