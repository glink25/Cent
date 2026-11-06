import type {
    History,
    Provider,
    ProviderRequestChunk,
    Tool,
} from "../assistant";
import { withAbort } from "../assistant";
import { serializeToolResult } from "../assistant/context";
import { formatUserReferences } from "../assistant/references";
import { encodeImages, isImage, supportsImages } from "./images";
import { getAdapter } from "./registry";
import type {
    AIConfig,
    BuildBodyOptions,
    ChatMessage,
    JSONObject,
} from "./types";

/**
 * 这些字段承载会话上下文、工具协议和流式解析约定，必须使用 adapter 生成的值。
 * 自定义参数仍可包含同名键，但合并时会被系统值静默覆盖。
 */
const PROTECTED_REQUEST_PARAMS = [
    "model",
    "messages",
    "contents",
    "systemInstruction",
    "stream",
    "tools",
] as const;

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

    let assetIndex = 1;
    for (const msg of history) {
        if (msg.role === "user") {
            const userContent = formatUserReferences(msg);
            const assetPrompt =
                msg.assets && msg.assets.length > 0
                    ? options.formatUserAssets?.(
                          msg.assets,
                          msg.assetStartIndex ?? assetIndex,
                      )
                    : undefined;
            messages.push({
                role: "user",
                content: `${assetPrompt ? `${assetPrompt}\n` : ""}${userContent}`,
            });
            assetIndex += msg.assets?.length ?? 0;
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
                content: msg.contextContent ?? serializeToolResult(msg),
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
    const generatedBody = adapter.buildBody(config, messages, tools, {
        temperature: options?.temperature ?? 0.7,
        // 默认 8192：推理模型的思考过程也消耗 token，太小会在思考阶段就被截断。
        maxTokens: options?.maxTokens ?? config.maxTokens ?? 8192,
    });
    const body = mergeCustomParams(generatedBody, config.customParams);
    // In particular, summary requests must stay tool-free despite custom params.
    if (!tools.length) {
        delete body.tools;
        delete body.tool_choice;
        delete body.toolConfig;
        delete body.parallel_tool_calls;
    }
    delete body.functions;
    delete body.function_call;
    if (config.apiType === "google-ai-studio") {
        body.generationConfig = {
            ...(body.generationConfig as JSONObject),
            maxOutputTokens: options?.maxTokens ?? effectiveMaxTokens(config),
        };
    } else {
        body.max_tokens = options?.maxTokens ?? effectiveMaxTokens(config);
        if (Object.hasOwn(body, "max_completion_tokens")) {
            body.max_completion_tokens = body.max_tokens;
            delete body.max_tokens;
        }
    }

    return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortSignal,
    });
}

/**
 * 自定义参数只在请求体顶层做浅合并，普通同名字段以自定义值为准；会影响会话与
 * 流式协议的核心字段则静默保留 adapter 生成值。运行时校验用于尽早发现损坏的同步数据。
 */
export function mergeCustomParams(
    generatedBody: unknown,
    customParams?: JSONObject,
): JSONObject {
    if (!isJSONObject(generatedBody)) {
        throw new Error("AI provider request body must be a JSON object");
    }
    if (customParams === undefined) return generatedBody;
    if (!isJSONCompatibleObject(customParams)) {
        throw new Error("AI customParams must be a JSON object");
    }
    const merged = { ...generatedBody, ...customParams };
    for (const key of PROTECTED_REQUEST_PARAMS) {
        // 仅恢复当前协议实际生成的核心字段，避免凭空向其他协议写入无关字段。
        if (Object.hasOwn(generatedBody, key)) {
            merged[key] = generatedBody[key];
        }
    }
    return merged;
}

function isJSONObject(value: unknown): value is JSONObject {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isJSONCompatibleObject(value: unknown): value is JSONObject {
    return (
        isJSONObject(value) && Object.values(value).every(isJSONCompatibleValue)
    );
}

function isJSONCompatibleValue(value: unknown): boolean {
    if (
        value === null ||
        typeof value === "string" ||
        typeof value === "boolean"
    ) {
        return true;
    }
    if (typeof value === "number") return Number.isFinite(value);
    if (Array.isArray(value)) return value.every(isJSONCompatibleValue);
    return isJSONCompatibleObject(value);
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
export type AIConfigGetter = (
    configId?: string,
) => AIConfig | Promise<AIConfig>;

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
        async getContextPolicy(configId) {
            const config = await getConfig(configId);
            return {
                contextWindow: config.contextWindow ?? 131072,
                maxOutputTokens: effectiveMaxTokens(config),
            };
        },
        request({ history, tools, maxTokens, purpose, configId }) {
            let aborted = false;
            let abortController: AbortController | null = null;

            const promise = (async () => {
                const config = await getConfig(configId);
                const messages = historyToMessages(history, options);
                if (purpose !== "summary") {
                    const latest = history.findLastIndex(
                        (message) => message.role === "user",
                    );
                    const user = history[latest];
                    const message = messages[latest];
                    if (user?.role === "user" && message?.role === "user") {
                        const files = user.assets?.filter(isImage) ?? [];
                        if (files.length && !supportsImages(config))
                            throw new Error("当前 AI 模型配置未启用图片输入。");
                        if (files.length)
                            message.images = await encodeImages(files);
                    }
                }

                abortController = new AbortController();
                if (aborted) {
                    abortController.abort();
                }

                const response = await createStreamingRequest(
                    config,
                    config.apiKey,
                    messages,
                    tools,
                    {
                        maxTokens: maxTokens ?? effectiveMaxTokens(config),
                        ...(purpose === "summary" ? { temperature: 0.2 } : {}),
                    },
                    abortController.signal,
                );

                if (!response.ok) {
                    const errorText = await response.text();
                    throw Object.assign(
                        new Error(
                            `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
                        ),
                        { status: response.status },
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

export function effectiveMaxTokens(config: AIConfig): number {
    const generation = config.customParams?.generationConfig as
        | JSONObject
        | undefined;
    const value =
        config.apiType === "google-ai-studio"
            ? generation?.maxOutputTokens
            : (config.customParams?.max_completion_tokens ??
              config.customParams?.max_tokens);
    const result = value ?? config.maxTokens ?? 8192;
    if (typeof result !== "number" || !Number.isInteger(result) || result < 1)
        throw new Error("Invalid model output token limit");
    return result;
}
