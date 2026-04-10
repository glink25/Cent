import type { AIConfig } from "@/ledger/extra-type";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import type { ProviderRequestChunk } from "../../assistant/type";

function getAIConfig(): AIConfig {
    const userId = useUserStore.getState().id;
    const assistantData =
        useLedgerStore.getState().infos?.meta.personal?.[userId]?.assistant;

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

function buildStreamingUrl(config: AIConfig): string {
    if (config.apiType === "google-ai-studio") {
        const baseUrl = config.apiUrl.endsWith("/")
            ? config.apiUrl.slice(0, -1)
            : config.apiUrl;
        return `${baseUrl}/v1beta/models/${config.model}:streamGenerateContent?alt=sse`;
    } else {
        return config.apiUrl.endsWith("/")
            ? `${config.apiUrl}chat/completions`
            : `${config.apiUrl}/chat/completions`;
    }
}

function buildStreamingHeaders(
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

function buildStreamingBody(
    config: AIConfig,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    options?: {
        temperature?: number;
        max_tokens?: number;
        maxOutputTokens?: number;
    },
): unknown {
    if (config.apiType === "google-ai-studio") {
        const contents: Array<{
            role: "user" | "model";
            parts: Array<{ text: string }>;
        }> = [];

        let systemInstruction: string | undefined;

        for (const msg of messages) {
            if (msg.role === "system") {
                if (systemInstruction) {
                    systemInstruction += "\n\n" + msg.content;
                } else {
                    systemInstruction = msg.content;
                }
            } else {
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

        if (systemInstruction) {
            requestBody.systemInstruction = {
                parts: [{ text: systemInstruction }],
            };
        }

        return requestBody;
    } else {
        return {
            model: config.model,
            messages,
            stream: true,
            temperature: options?.temperature ?? 0.7,
            max_tokens: options?.max_tokens ?? 2000,
        };
    }
}
type StreamChunk = ProviderRequestChunk;
// open ai和google studio api有时候会返回原生思考字段，请将这两个方法修改为返回ReadableStream<{thought:string,answer:string}>,将原生的thought解析出来

async function* parseOpenAIStream(
    response: Response,
): AsyncIterable<StreamChunk> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // 维护全量内容
    let fullThought = "";
    let fullAnswer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

                const jsonStr = trimmedLine.slice(6);
                if (jsonStr === "[DONE]") continue;

                try {
                    const data = JSON.parse(jsonStr);
                    const delta = data.choices?.[0]?.delta;

                    const t = delta?.reasoning_content || "";
                    const a = delta?.content || "";

                    if (t || a) {
                        // 累加到全量变量中
                        fullThought += t;
                        fullAnswer += a;
                        // 返回当前已累计的所有内容
                        yield { thought: fullThought, answer: fullAnswer };
                    }
                } catch (error) {
                    console.warn("Failed to parse OpenAI SSE line:", error);
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}
async function* parseGoogleStream(
    response: Response,
): AsyncIterable<StreamChunk> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    // 维护全量内容
    let fullThought = "";
    let fullAnswer = "";

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

                const jsonStr = trimmedLine.slice(6);
                try {
                    const data = JSON.parse(jsonStr);
                    const parts = data.candidates?.[0]?.content?.parts || [];

                    let hasNewContent = false;
                    for (const part of parts) {
                        if (part.thought === true || "thought" in part) {
                            fullThought += part.text || "";
                            hasNewContent = true;
                        } else {
                            fullAnswer += part.text || "";
                            hasNewContent = true;
                        }
                    }

                    if (hasNewContent) {
                        // 返回包含之前所有内容的完整对象
                        yield { thought: fullThought, answer: fullAnswer };
                    }
                } catch (error) {
                    console.warn("Failed to parse Google SSE line:", error);
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export async function createStreamingRequest(
    config: AIConfig,
    apiKey: string,
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    abortSignal?: AbortSignal,
): Promise<Response> {
    const url = buildStreamingUrl(config);
    const headers = buildStreamingHeaders(config.apiType, apiKey);
    const body = buildStreamingBody(config, messages, {
        temperature: 0.7,
        max_tokens: 2000,
    });

    return fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: abortSignal,
    });
}

async function requestAIWithConfig(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
    config: AIConfig,
): Promise<string> {
    const abortController = new AbortController();
    const response = await createStreamingRequest(
        config,
        config.apiKey,
        messages,
        abortController.signal,
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
            `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
        );
    }

    const parser =
        config.apiType === "google-ai-studio"
            ? parseGoogleStream
            : parseOpenAIStream;

    let fullAnswer = "";
    for await (const chunk of parser(response)) {
        if (chunk.answer?.trim() || chunk.thought?.trim()) {
            abortController.abort();
            fullAnswer += chunk.answer || "";
        }
    }
    return fullAnswer;
}

export async function requestAI(
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
) {
    return requestAIWithConfig(messages, getAIConfig());
}

export {
    getAIConfig,
    parseOpenAIStream,
    parseGoogleStream,
    requestAIWithConfig,
};
