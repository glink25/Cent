import type { AIConfig } from "@/ledger/extra-type";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { decodeApiKey } from "@/utils/api-key";

/**
 * 从 store 获取 AI 配置
 * @returns AI配置对象
 * @throws 如果没有配置或没有默认配置时抛出错误
 */
function getAIConfig(): AIConfig {
    const userId = useUserStore.getState().id;
    const assistantData =
        useLedgerStore.getState().infos?.meta.personal?.[userId]?.assistant;

    // 优先使用新的配置系统
    if (assistantData?.configs && assistantData.configs.length > 0) {
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

    // Fallback: 如果新配置不存在，尝试使用旧的 bigmodel 配置
    const oldApiKey = assistantData?.bigmodel?.apiKey;
    if (oldApiKey) {
        // 构造一个临时的配置对象，使用智谱 AI 的默认配置
        return {
            id: "legacy-bigmodel",
            name: "智谱GLM (Legacy)",
            apiKey: oldApiKey,
            apiUrl: "https://open.bigmodel.cn/api/paas/v4",
            model: "glm-4-flash",
            apiType: "open-ai-compatible",
        };
    }

    // 如果新旧配置都不存在，抛出错误
    throw new Error(t("ai-config-required-error"));
}

/**
 * 构建 AI API 请求的 URL
 * @param config AI 配置
 * @returns 完整的 API URL
 */
function buildAIRequestUrl(config: AIConfig): string {
    if (config.apiType === "google-ai-studio") {
        // Google AI Studio API URL 格式
        if (config.apiUrl.includes(":generateContent")) {
            return config.apiUrl;
        }
        const baseUrl = config.apiUrl.endsWith("/")
            ? config.apiUrl.slice(0, -1)
            : config.apiUrl;
        return `${baseUrl}/v1beta/models/${config.model}:generateContent`;
    } else {
        // OpenAI 兼容格式
        return config.apiUrl.endsWith("/")
            ? `${config.apiUrl}chat/completions`
            : `${config.apiUrl}/chat/completions`;
    }
}

/**
 * 构建 AI API 请求的请求头
 * @param apiType API 类型
 * @param apiKey API Key
 * @returns 请求头对象
 */
function buildAIRequestHeaders(
    apiType: AIConfig["apiType"],
    apiKey: string,
): Record<string, string> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
    };

    if (apiType === "google-ai-studio") {
        headers["x-goog-api-key"] = apiKey;
    } else {
        headers["Authorization"] = `Bearer ${apiKey}`;
    }

    return headers;
}

/**
 * 构建 AI API 请求体
 * @param config AI 配置
 * @param messages 消息列表
 * @param options 可选参数（temperature, max_tokens/maxOutputTokens）
 * @returns 请求体对象
 */
function buildAIRequestBody(
    config: AIConfig,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: {
        temperature?: number;
        max_tokens?: number;
        maxOutputTokens?: number;
    },
): unknown {
    if (config.apiType === "google-ai-studio") {
        // Google AI Studio 格式
        const contents: Array<{
            role: "user" | "model";
            parts: Array<{ text: string }>;
        }> = [];

        let systemInstruction: string | undefined;

        for (const msg of messages) {
            if (msg.role === "system") {
                // 收集 system 消息作为 systemInstruction
                if (systemInstruction) {
                    systemInstruction += "\n\n" + msg.content;
                } else {
                    systemInstruction = msg.content;
                }
            } else {
                // user 和 assistant 消息转换为 contents
                const role = msg.role === "user" ? "user" : "model";
                contents.push({
                    role,
                    parts: [{ text: msg.content }],
                });
            }
        }

        const requestBody: {
            contents: typeof contents;
            systemInstruction?: { parts: Array<{ text: string }> };
            generationConfig?: {
                temperature?: number;
                maxOutputTokens?: number;
            };
        } = {
            contents,
            generationConfig: {
                temperature: options?.temperature ?? 0.7,
                maxOutputTokens:
                    options?.maxOutputTokens ?? options?.max_tokens ?? 2000,
            },
        };

        // 如果有 system instruction，添加到请求中
        if (systemInstruction) {
            requestBody.systemInstruction = {
                parts: [{ text: systemInstruction }],
            };
        }

        return requestBody;
    } else {
        // OpenAI 兼容格式
        return {
            model: config.model,
            messages,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.max_tokens ?? 2000,
        };
    }
}

/**
 * 通用的 AI API 请求函数
 * @param config AI 配置
 * @param apiKey 解码后的 API Key
 * @param messages 消息列表
 * @param options 可选参数（temperature, max_tokens/maxOutputTokens）
 * @returns fetch Response 对象
 */
export async function makeAIAPIRequest(
    config: AIConfig,
    apiKey: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: {
        temperature?: number;
        max_tokens?: number;
        maxOutputTokens?: number;
    },
): Promise<Response> {
    const url = buildAIRequestUrl(config);
    const headers = buildAIRequestHeaders(config.apiType, apiKey);
    const body = buildAIRequestBody(config, messages, options);

    return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
    });
}

/**
 * AI API 请求，支持 OpenAI 兼容和 Google AI Studio 的 API 格式
 * @param messages 结构化的消息列表，包含 system、user、assistant 角色的消息
 */
export const requestAI = async (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    _config?: AIConfig,
): Promise<string> => {
    // 从 store 获取 AI 配置
    const config = _config ?? getAIConfig();

    // 解码 base64 编码的 API Key
    const apiKey = decodeApiKey(config.apiKey);

    // 根据 API 类型选择不同的请求方式
    if (config.apiType === "google-ai-studio") {
        return requestGoogleAIStudio(config, apiKey, messages);
    } else {
        return requestOpenAICompatible(config, apiKey, messages);
    }
};

/**
 * OpenAI 兼容格式的 API 请求
 */
async function requestOpenAICompatible(
    config: AIConfig,
    apiKey: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string> {
    try {
        const response = await makeAIAPIRequest(config, apiKey, messages, {
            temperature: 0.7,
            max_tokens: 2000,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
            );
        }

        const data = await response.json();

        // 提取 AI 响应文本
        if (data.choices && data.choices.length > 0) {
            const content = data.choices[0].message?.content;
            if (typeof content === "string") {
                return content;
            }
        }

        throw new Error("AI API 响应格式异常");
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`AI API 请求异常: ${String(error)}`);
    }
}

/**
 * Google AI Studio 格式的 API 请求
 */
async function requestGoogleAIStudio(
    config: AIConfig,
    apiKey: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string> {
    try {
        const response = await makeAIAPIRequest(config, apiKey, messages, {
            temperature: 0.7,
            maxOutputTokens: 2000,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
            );
        }

        const data = await response.json();

        // 提取 AI 响应文本
        // Google AI Studio 响应格式: candidates[0].content.parts[0].text
        if (data.candidates && data.candidates.length > 0) {
            const candidate = data.candidates[0];
            if (
                candidate.content?.parts &&
                candidate.content.parts.length > 0
            ) {
                const text = candidate.content.parts[0].text;
                if (typeof text === "string") {
                    return text;
                }
            }
        }

        throw new Error("AI API 响应格式异常");
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`AI API 请求异常: ${String(error)}`);
    }
}
