import type {
    History,
    Provider,
    ProviderRequestChunk,
    Tool,
    ToolMessage,
} from "../assistant";
import { withAbort } from "../assistant";
import { getAdapter } from "./registry";
import type { AIConfig, BuildBodyOptions, ChatMessage } from "./types";

/**
 * 把单条工具结果消息渲染成回传给模型的纯文本。返回值过长时居中截断。
 */
function truncateLongText(text: string, maxLength = 10000): string {
    if (text.length <= maxLength) return text;
    const head = text.slice(0, maxLength / 2);
    const tail = text.slice(-maxLength / 2);
    console.warn(`Text truncated: ${text.length} -> ${maxLength}`);
    return `${head}...（返回值过长，已截断）...${tail}`;
}

function formatValue(value: unknown): string {
    return truncateLongText(JSON.stringify(value));
}

function toolMessageToContent(toolMsg: ToolMessage): string {
    let content = `[工具调用: ${toolMsg.formatted.name}]\n`;
    content += `参数: ${JSON.stringify(toolMsg.formatted.params, null, 2)}\n`;

    if (toolMsg.formatted.returns !== undefined) {
        content += `返回结果: ${formatValue(toolMsg.formatted.returns)}`;
    }
    if (toolMsg.formatted.errors !== undefined) {
        content += `错误: ${formatValue(toolMsg.formatted.errors)}`;
    }

    return content;
}

export type HistoryToMessagesOptions = {
    /**
     * 自定义「用户上传的附件」如何渲染进 user 消息。返回的文本会拼接到用户原文之前。
     * 不提供则忽略附件（核心层不感知附件如何被工具访问，这属于宿主应用约定）。
     */
    formatUserAssets?: (assets: File[], startIndex: number) => string;
};

export function historyToMessages(
    history: History,
    options: HistoryToMessagesOptions = {},
): ChatMessage[] {
    const messages: ChatMessage[] = [];

    const assetIndex = 1;
    for (const msg of history) {
        if (msg.role === "user") {
            const userContent = msg.raw;
            const assetPrompt =
                msg.assets && msg.assets.length > 0
                    ? options.formatUserAssets?.(msg.assets, assetIndex)
                    : undefined;
            messages.push({
                role: "user",
                content: `${assetPrompt ? `${assetPrompt}\n` : ""}${userContent}`,
            });
        } else if (msg.role === "assistant") {
            const tools = msg.formatted.tools;
            messages.push({
                role: "assistant",
                content: msg.formatted.answer ?? "",
                ...(tools && tools.length > 0 ? { toolCalls: tools } : {}),
            });
        } else if (msg.role === "tool") {
            // 工具结果作为带 tool_call_id 的原生 tool 消息回传，由 adapter 翻译。
            messages.push({
                role: "tool",
                toolCallId: msg.formatted.id ?? "",
                name: msg.formatted.name,
                content: toolMessageToContent(msg),
            });
        } else if (msg.role === "system") {
            messages.push({
                role: "system",
                content: msg.raw,
            });
        }
    }

    return messages;
}

/**
 * 发起一次流式请求。所有协议相关逻辑（URL/鉴权头/请求体/流解析）都由对应的
 * adapter 负责，这里只是「取 adapter → fetch」。
 */
export async function createStreamingRequest(
    config: AIConfig,
    apiKey: string,
    messages: ChatMessage[],
    tools: Tool[],
    options?: BuildBodyOptions,
    abortSignal?: AbortSignal,
): Promise<Response> {
    const adapter = getAdapter(config.apiType);
    const url = adapter.buildUrl(config);
    const headers = adapter.buildHeaders(config, apiKey);
    const body = adapter.buildBody(config, messages, tools, {
        temperature: options?.temperature ?? 0.7,
        // 默认 8192：推理模型的思考过程也消耗 token，太小会在思考阶段就被截断。
        maxTokens: options?.maxTokens ?? config.maxTokens ?? 8192,
    });

    return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortSignal,
    });
}

export function parseStream(
    config: AIConfig,
    response: Response,
): AsyncIterable<ProviderRequestChunk> {
    return getAdapter(config.apiType).parseStream(response);
}

/**
 * 取一份「已可直接使用」的通用配置（apiKey 已解密）。选哪份配置、如何解密都由
 * 调用方决定 —— provider 层只拿到通用配置，不感知 configId 之类的领域概念。
 */
export type AIConfigGetter = () => AIConfig | Promise<AIConfig>;

export type CreateAIProviderOptions = HistoryToMessagesOptions;

/**
 * 通用 AI Provider 工厂。调用方只需提供「如何取一份可用配置」的回调，
 * 协议分发（openai / google-ai-studio）、消息归一化、流式抽取全部由本层负责。
 */
export function createAIProvider(
    getConfig: AIConfigGetter,
    options: CreateAIProviderOptions = {},
): Provider {
    return {
        request({ history, tools }) {
            let aborted = false;
            let abortController: AbortController | null = null;

            const promise = (async () => {
                const config = await getConfig();
                const messages = historyToMessages(history, options);

                abortController = new AbortController();
                if (aborted) {
                    abortController.abort();
                }

                const response = await createStreamingRequest(
                    config,
                    config.apiKey,
                    messages,
                    tools,
                    undefined,
                    abortController.signal,
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw new Error(
                        `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
                    );
                }

                return parseStream(config, response);
            })();

            return withAbort(promise, () => {
                aborted = true;
                abortController?.abort();
            });
        },
    };
}
