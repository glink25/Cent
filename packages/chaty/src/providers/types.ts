import type {
    ProviderRequestChunk,
    ProviderToolCall,
    Tool,
} from "../assistant";

/**
 * provider 层发起请求所需的最小配置。只包含协议相关字段；像 id/name 这类
 * 调用方（如 cent）的领域信息不属于这里。调用方的配置只要结构兼容即可直接传入。
 */
export type AIConfig = {
    apiKey: string; // base64 encoded
    apiUrl: string;
    model: string;
    /** 支持 OpenAI 兼容与 Google AI Studio 两种 API 格式。 */
    apiType: "open-ai-compatible" | "google-ai-studio";
    /**
     * 单次生成的最大 token 数。推理模型思考阶段也会消耗该预算，设置过小会在思考
     * 未完成时就被 finish_reason="length" 截断。不填则使用默认值。
     */
    maxTokens?: number;
};

/**
 * 协议无关的「规范消息」。historyToMessages 产出这种形态，由各 adapter 翻译成
 * 具体协议的 wire 格式。工具调用与工具结果都用结构化字段表达，不再塞进纯文本。
 */
export type ChatMessage =
    | { role: "system" | "user"; content: string }
    | { role: "assistant"; content: string; toolCalls?: ProviderToolCall[] }
    | { role: "tool"; toolCallId: string; name: string; content: string };

export type BuildBodyOptions = {
    temperature?: number;
    maxTokens?: number;
};

/**
 * 一种 AI API 协议的适配器。所有「协议相关」逻辑（URL、鉴权头、请求体构造、
 * 流解析）都收敛在这里。新增一种接口类型 = 新增一个 adapter 并 registerAdapter，
 * 上层（session / parser / 工具定义）完全不感知协议差异。
 */
export interface ProviderAdapter {
    /** 唯一标识，对应 AIConfig.apiType。 */
    apiType: AIConfig["apiType"];
    buildUrl(config: AIConfig): string;
    buildHeaders(config: AIConfig, apiKey: string): Record<string, string>;
    /** 规范消息 + 规范工具 → 该协议的请求体。 */
    buildBody(
        config: AIConfig,
        messages: ChatMessage[],
        tools: Tool[],
        options: BuildBodyOptions,
    ): unknown;
    /** 该协议的 SSE 流 → 规范 chunk（负责抽取 tool_calls / finish_reason）。 */
    parseStream(response: Response): AsyncIterable<ProviderRequestChunk>;
}
