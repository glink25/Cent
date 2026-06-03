/**
 * 「大模型回复结构化解析器」。
 *
 * 它假设模型会输出如下格式：
 *
 * <overview>展示标题</overview>
 * <thought>思考过程</thought>
 * <tool>{"name":"search","params":{"q":"hello"}}</tool>
 * 普通回复文本
 *
 * parseResult 的目标是：
 * - 将大模型原始文本解析为结构化 AssistantMessage
 * - 尽可能兼容流式输出与不完整标签
 * - 在不完全依赖模型严格格式化的情况下提取有效内容
 *
 * ------------------------------------------------------------------------
 * 实现方式：单趟状态机（state machine）
 * ------------------------------------------------------------------------
 *
 * 由于上层每个流式 chunk 传入的都是「累计全量文本」，parseResult 是幂等的
 * 全量重解析——每次从完整字符串重新扫描，无需跨调用维护状态。
 *
 * 输入同时包含推理流 result.thought 与回复流 result.answer，两者都会被扫描：
 * - answer 流里未被标签包裹的纯文本归入 answer
 * - thought 流里未被标签包裹的纯文本归入 thought（推理内容本身即思考）
 * - <overview>/<thought>/<tool> 标签内容无论出现在哪个流都会被正确归类，
 *   因此即便 answer 为空、内容全在 thought 流里也能解析出来
 *
 * 扫描时在 TEXT / OVERVIEW / THOUGHT / TOOL 之间切换，各标签策略如下：
 *
 * overview:
 * - 必须等待 </overview> 闭合后才输出（通常是完整标题，提前截断会不完整）
 * - 未闭合则不输出
 *
 * thought:
 * - 偏向“实时展示”，允许在未闭合时输出已有的部分内容
 * - 输出时剥离尾部正在到达的半截闭合标签，避免闪烁出 `<` 等残缺字符
 *
 * tool:
 * - 必须等待 </tool> 完整闭合且 JSON 解析成功才输出，否则忽略
 * - 闭合标签按字面量 indexOf("</tool>") 查找，扫描期间忽略 JSON 内部的
 *   `<` / `>` / 换行——因此不会再像 regex 方案那样在 <div> 处误截断
 *
 * ------------------------------------------------------------------------
 * 实际解析例子
 * ------------------------------------------------------------------------
 *
 * 示例 1：
 *
 * 输入：
 *
 * parseResult({
 *   answer:
 *     "<overview>天气查询</overview>" +
 *     "<thought>正在搜索北京天气</thought>" +
 *     "北京今天晴天，25度"
 * })
 *
 * 解析结果：
 *
 * {
 *   formatted: {
 *     overview: "天气查询",
 *     thought: "正在搜索北京天气",
 *     answer: "北京今天晴天，25度"
 *   }
 * }
 *
 * ------------------------------------------------------------------------
 *
 * 示例 2：
 *
 * 输入：
 *
 * parseResult({
 *   answer:
 *     "<thought>正在调用工具</thought>" +
 *     "<tool>{\"name\":\"weather\",\"params\":{\"city\":\"Beijing\"}}</tool>"
 * })
 *
 * 解析结果：
 *
 * {
 *   formatted: {
 *     thought: "正在调用工具",
 *     tools: [
 *       {
 *         name: "weather",
 *         params: {
 *           city: "Beijing"
 *         }
 *       }
 *     ]
 *   }
 * }
 *
 * ------------------------------------------------------------------------
 *
 * 示例 3（tool JSON 不完整）：
 *
 * 输入：
 *
 * parseResult({
 *   answer:
 *     "<tool>{\"name\":\"weather\",\"params\":{\"city\":\"Bei"
 * })
 *
 * 可能结果：
 *
 * {
 *   formatted: {
 *     tools: []
 *   }
 * }
 *
 * 原因：
 * - tool 尚未闭合
 * - JSON 不完整
 * - JSON.parse/jsonrepair 可能失败
 * - 当前实现会直接忽略该 tool
 *
 * ------------------------------------------------------------------------
 *
 * 示例 4（overview 未闭合）：
 *
 * 输入：
 *
 * parseResult({
 *   answer:
 *     "<overview>天气查询"
 * })
 *
 * 当前可能结果：
 *
 * {
 *   formatted: {
 *     overview: "天气查询"
 *   }
 * }
 *
 * 但这并不可靠：
 * - regex 无法真正判断 overview 是否已经结束
 * - 后续文本仍可能继续属于 overview
 *
 * ------------------------------------------------------------------------
 *
 * 示例 5（tool 内包含 <）：
 *
 * 输入：
 *
 * parseResult({
 *   answer:
 *     "<tool>{\"html\":\"<div>hello</div>\"}</tool>"
 * })
 *
 * 状态机实现下：
 *
 * - 仅按字面量查找 </tool>，不会在 <div> 处误截断
 * - 完整 JSON 被正确解析（这是旧 regex 方案最大的缺陷之一，现已修复）
 */

import { jsonrepair } from "jsonrepair";
import type { AssistantMessage, ProviderRequestChunk, Skill } from "./type";

export type ToolCall = {
    name: string;
    params: unknown;
    raw: string;
};

// 受支持的结构化标签
const TAGS = ["overview", "thought", "tool"] as const;

/**
 * 若 `text` 末尾是任一给定 token 的真前缀（如 `<`、`</`、`</tho`、`<over`），
 * 则将其剥离。用于流式场景：标签逐字符到达时，避免末尾短暂闪烁出
 * `<` 等残缺字符。
 */
function stripTrailingPartialToken(text: string, tokens: string[]): string {
    let cut = 0;
    for (const token of tokens) {
        // 仅匹配真前缀（不含完整 token 本身）
        for (
            let len = Math.min(token.length - 1, text.length);
            len >= 1;
            len--
        ) {
            if (text.endsWith(token.slice(0, len))) {
                cut = Math.max(cut, len);
                break;
            }
        }
    }
    return cut > 0 ? text.slice(0, text.length - cut) : text;
}

type ParserState = "TEXT" | "OVERVIEW" | "THOUGHT" | "TOOL";

// 所有可能在流式文本末尾出现的「半截标签」token，用于剥离避免闪烁
const ALL_TAG_TOKENS = [
    ...TAGS.map((t) => `<${t}>`),
    ...TAGS.map((t) => `</${t}>`),
    "<answer>",
    "</answer>",
];

type ParseAcc = {
    overview: string;
    thought: string;
    answer: string;
    tools?: { name: string; params: unknown }[];
};

/**
 * 单趟状态机扫描一段文本，并将结果累加到 acc。
 *
 * `defaultField` 指定未被任何标签包裹的纯文本应归入哪个字段：
 * - 扫描 result.answer 时为 "answer"
 * - 扫描 result.thought（推理流）时为 "thought"，因为推理内容本身就是思考
 *
 * 标签内容（<overview>/<thought>/<tool>）无论出现在哪个流都会被正确归类，
 * 因此即便 answer 为空、全部内容在 thought 流里，也能解析出来。
 */
function scanInto(
    text: string,
    defaultField: "thought" | "answer",
    acc: ParseAcc,
) {
    const len = text.length;
    let rest = ""; // 本次扫描中归入 defaultField 的纯文本
    let state: ParserState = "TEXT";
    let i = 0;

    // 解析单个 tool 内容（JSON），成功则追加到 tools，失败则忽略（与文档一致）
    const pushTool = (raw: string) => {
        const trimmed = raw.trim();
        if (!trimmed) return;
        try {
            const parsed = JSON.parse(jsonrepair(trimmed));
            if (!acc.tools) acc.tools = [];
            acc.tools.push({
                name: parsed.name || "unknown_tool",
                params: parsed.params || {},
            });
        } catch (e) {
            console.error("JSON Repair/Parse failed:", e, "Content:", trimmed);
        }
    };

    while (i < len) {
        if (state === "TEXT") {
            if (text.startsWith("<overview>", i)) {
                state = "OVERVIEW";
                i += "<overview>".length;
            } else if (text.startsWith("<thought>", i)) {
                state = "THOUGHT";
                i += "<thought>".length;
            } else if (text.startsWith("<tool>", i)) {
                state = "TOOL";
                i += "<tool>".length;
            } else if (text.startsWith("<answer>", i)) {
                i += "<answer>".length; // 剥离 answer 包裹标签
            } else if (text.startsWith("</answer>", i)) {
                i += "</answer>".length;
            } else {
                rest += text[i];
                i++;
            }
            continue;
        }

        if (state === "OVERVIEW") {
            const close = text.indexOf("</overview>", i);
            if (close !== -1) {
                acc.overview += text.slice(i, close).trim();
                i = close + "</overview>".length;
                state = "TEXT";
            } else {
                // overview 必须等待闭合，未闭合则严格丢弃
                i = len;
            }
            continue;
        }

        if (state === "THOUGHT") {
            const close = text.indexOf("</thought>", i);
            if (close !== -1) {
                acc.thought += text.slice(i, close).trim();
                i = close + "</thought>".length;
                state = "TEXT";
            } else {
                // thought 偏实时展示，输出已有部分（剥离尾部半个闭合标签）
                acc.thought += stripTrailingPartialToken(text.slice(i), [
                    "</thought>",
                ]).trim();
                i = len;
            }
            continue;
        }

        // state === "TOOL"：仅按字面量查找 </tool>，忽略 JSON 内部的 < / >
        const close = text.indexOf("</tool>", i);
        if (close !== -1) {
            pushTool(text.slice(i, close));
            i = close + "</tool>".length;
            state = "TEXT";
        } else {
            // tool 未闭合，忽略整段
            i = len;
        }
    }

    // 归入 defaultField 的纯文本：剥离尾部正在到达的半截标签（如 `<over`、`</`），
    // 避免流式过程中残缺标签短暂出现
    const cleaned = stripTrailingPartialToken(
        rest.replace(/\n{2,}/g, "\n"),
        ALL_TAG_TOKENS,
    ).trim();
    if (cleaned)
        acc[defaultField] += acc[defaultField] ? `\n${cleaned}` : cleaned;
}

export function parseResult(result: ProviderRequestChunk): AssistantMessage {
    const acc: ParseAcc = { overview: "", thought: "", answer: "" };

    // 推理流与回复流都需要解析：结构化标签可能出现在任意一个流里，
    // 且当 answer 为空时全部内容可能都在 thought 流中。
    if (result.thought) scanInto(result.thought, "thought", acc);
    scanInto(result.answer, "answer", acc);

    return {
        role: "assistant",
        raw: result.answer,
        formatted: {
            thought: acc.thought,
            answer: acc.answer,
            overview: acc.overview,
            ...(acc.tools ? { tools: acc.tools } : {}),
        },
    };
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
