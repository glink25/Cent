import type { AIConfig } from "@/ledger/extra-type";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { decodeApiKey } from "@/utils/api-key";
import type { ProviderRequestChunk, Tool } from "../../assistant";
import { getAdapter } from "./adapters";
import type { ChatMessage } from "./adapters/types";

/** 纯文本消息（语音解析 / 连通性测试等非 ReAct 路径使用）。 */
export type TextMessage = {
    role: "system" | "user" | "assistant";
    content: string;
};

function getAIConfig(configId?: string): AIConfig {
    const userId = useUserStore.getState().id;
    const assistantData =
        useLedgerStore.getState().infos?.meta.personal?.[userId]?.assistant;

    if (assistantData?.configs && assistantData.configs.length > 0) {
        if (configId) {
            const config = assistantData.configs.find((c) => c.id === configId);
            if (config) {
                return config;
            }
        }
        const defaultConfigId = assistantData.defaultConfigId;
        if (defaultConfigId) {
            const config = assistantData.configs.find(
                (c) => c.id === defaultConfigId,
            );
            if (config) {
                return config;
            }
        }
    }

    const oldApiKey = assistantData?.bigmodel?.apiKey;
    if (oldApiKey) {
        return {
            id: "legacy-bigmodel",
            name: "智谱GLM (Legacy)",
            apiKey: oldApiKey,
            apiUrl: "https://open.bigmodel.cn/api/paas/v4",
            model: "glm-4-flash",
            apiType: "open-ai-compatible",
        };
    }

    throw new Error("未找到 AI 配置，请先在设置中配置 AI API");
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
    abortSignal?: AbortSignal,
): Promise<Response> {
    const adapter = getAdapter(config.apiType);
    const url = adapter.buildUrl(config);
    const headers = adapter.buildHeaders(config, apiKey);
    const body = adapter.buildBody(config, messages, tools, {
        temperature: 0.7,
        // 默认 8192：推理模型的思考过程也消耗 token，太小会在思考阶段就被截断。
        maxTokens: config.maxTokens ?? 8192,
    });

    return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortSignal,
    });
}

function parseStream(
    config: AIConfig,
    response: Response,
): AsyncIterable<ProviderRequestChunk> {
    return getAdapter(config.apiType).parseStream(response);
}

async function requestAIWithConfig(
    messages: TextMessage[],
    config: AIConfig,
): Promise<string> {
    const response = await createStreamingRequest(
        config,
        config.apiKey,
        messages as ChatMessage[],
        [],
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
        );
    }

    let fullAnswer = "";
    for await (const chunk of parseStream(config, response)) {
        if (chunk.answer?.trim() || chunk.thought?.trim()) {
            fullAnswer = chunk.answer || "";
        }
    }
    return fullAnswer;
}

export async function requestAI(messages: TextMessage[]) {
    const config = getAIConfig();
    return requestAIWithConfig(messages, {
        ...config,
        apiKey: decodeApiKey(config.apiKey),
    });
}

function getVoiceAIConfig(): AIConfig {
    const id = usePreferenceStore.getState().voiceAIConfigId;
    return getAIConfig(id);
}

export async function requestAIForVoice(messages: TextMessage[]) {
    const config = getVoiceAIConfig();
    return requestAIWithConfig(messages, {
        ...config,
        apiKey: decodeApiKey(config.apiKey),
    });
}

export { getAIConfig, getVoiceAIConfig, parseStream, requestAIWithConfig };
