import type { ProviderRequestChunk, ProviderToolCall } from "../assistant";
import { toGeminiSchema } from "./schema";
import type {
    AIConfig,
    BuildBodyOptions,
    ChatMessage,
    ProviderAdapter,
} from "./types";

type FunctionResponsePart = {
    functionResponse: { name: string; response: unknown };
};
type GooglePart =
    | { text: string }
    | {
          functionCall: { name: string; args: unknown };
          thoughtSignature?: string;
      }
    | FunctionResponsePart;

type GoogleContent = { role: "user" | "model"; parts: GooglePart[] };

function toGoogleContents(messages: ChatMessage[]): {
    contents: GoogleContent[];
    systemInstruction?: string;
} {
    const contents: GoogleContent[] = [];
    let systemInstruction: string | undefined;

    const pushFunctionResponse = (part: FunctionResponsePart) => {
        // 把连续的工具结果合并进同一个 user content，符合 Gemini 对 functionResponse 的预期。
        const last = contents[contents.length - 1];
        if (
            last &&
            last.role === "user" &&
            last.parts.every((p) => "functionResponse" in p)
        ) {
            last.parts.push(part);
        } else {
            contents.push({ role: "user", parts: [part] });
        }
    };

    for (const msg of messages) {
        if (msg.role === "system") {
            systemInstruction = systemInstruction
                ? `${systemInstruction}\n\n${msg.content}`
                : msg.content;
        } else if (msg.role === "user") {
            contents.push({ role: "user", parts: [{ text: msg.content }] });
        } else if (msg.role === "assistant") {
            const parts: GooglePart[] = [];
            if (msg.content) parts.push({ text: msg.content });
            for (const tc of msg.toolCalls ?? []) {
                parts.push({
                    functionCall: { name: tc.name, args: tc.params ?? {} },
                    // 思考模型要求回传时原样带回 thoughtSignature。
                    ...(tc.thoughtSignature
                        ? { thoughtSignature: tc.thoughtSignature }
                        : {}),
                });
            }
            contents.push({ role: "model", parts });
        } else if (msg.role === "tool") {
            pushFunctionResponse({
                functionResponse: {
                    name: msg.name,
                    response: { content: msg.content },
                },
            });
        }
    }

    return { contents, systemInstruction };
}

async function* parseStream(
    response: Response,
): AsyncIterable<ProviderRequestChunk> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let fullThought = "";
    let fullAnswer = "";
    const toolCalls: ProviderToolCall[] = [];
    let finishReason: string | undefined;

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
                    const candidate = data.candidates?.[0];
                    const parts = candidate?.content?.parts || [];

                    if (candidate?.finishReason) {
                        finishReason = candidate.finishReason;
                    }

                    let hasText = false;
                    for (const part of parts) {
                        if (part.functionCall) {
                            toolCalls.push({
                                id: `call_${toolCalls.length}`,
                                name: part.functionCall.name,
                                params: part.functionCall.args ?? {},
                                // 必须保存并在下一轮回传，否则思考模型会 400。
                                ...(part.thoughtSignature
                                    ? {
                                          thoughtSignature:
                                              part.thoughtSignature,
                                      }
                                    : {}),
                            });
                        } else if (part.thought === true || "thought" in part) {
                            fullThought += part.text || "";
                            hasText = true;
                        } else {
                            fullAnswer += part.text || "";
                            hasText = true;
                        }
                    }

                    if (hasText) {
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

    if (toolCalls.length > 0) {
        yield {
            thought: fullThought,
            answer: fullAnswer,
            toolCalls,
            finishReason: finishReason ?? "tool_calls",
        };
    } else if (finishReason) {
        yield { thought: fullThought, answer: fullAnswer, finishReason };
    }
}

export const googleAIStudioAdapter: ProviderAdapter = {
    apiType: "google-ai-studio",
    buildUrl(config) {
        const baseUrl = config.apiUrl.endsWith("/")
            ? config.apiUrl.slice(0, -1)
            : config.apiUrl;
        return `${baseUrl}/v1beta/models/${config.model}:streamGenerateContent?alt=sse`;
    },
    buildHeaders(_config, apiKey) {
        return {
            "Content-Type": "application/json",
            "x-goog-api-key": apiKey,
        };
    },
    buildBody(
        _config: AIConfig,
        messages: ChatMessage[],
        tools,
        options: BuildBodyOptions,
    ) {
        const { contents, systemInstruction } = toGoogleContents(messages);
        const body: Record<string, unknown> = {
            contents,
            generationConfig: {
                temperature: options.temperature ?? 0.7,
                maxOutputTokens: options.maxTokens ?? 8192,
            },
        };
        if (systemInstruction) {
            body.systemInstruction = { parts: [{ text: systemInstruction }] };
        }
        if (tools.length > 0) {
            body.tools = [
                {
                    functionDeclarations: tools.map((t) => ({
                        name: t.name,
                        description: t.describe,
                        parameters: toGeminiSchema(t),
                    })),
                },
            ];
        }
        return body;
    },
    parseStream,
};
