import type { ProviderRequestChunk } from "../assistant";
import { toJsonSchema } from "./schema";
import { ProviderStreamError } from "./stream-error";
import type {
    AIConfig,
    BuildBodyOptions,
    ChatMessage,
    ProviderAdapter,
} from "./types";

type OpenAIMessage =
    | { role: "system" | "user"; content: string }
    | {
          role: "user";
          content: Array<
              | { type: "text"; text: string }
              | { type: "image_url"; image_url: { url: string } }
          >;
      }
    | {
          role: "assistant";
          content: string;
          tool_calls?: Array<{
              id: string;
              type: "function";
              function: { name: string; arguments: string };
          }>;
      }
    | { role: "tool"; tool_call_id: string; content: string };

function toOpenAIMessages(messages: ChatMessage[]): OpenAIMessage[] {
    return messages.map((msg): OpenAIMessage => {
        if (msg.role === "user" && msg.images?.length) {
            return {
                role: "user",
                content: [
                    {
                        type: "text",
                        text: msg.content || "Inspect the attached images.",
                    },
                    ...msg.images.map((image) => ({
                        type: "image_url" as const,
                        image_url: {
                            url: `data:${image.mimeType};base64,${image.data}`,
                        },
                    })),
                ],
            };
        }
        if (msg.role === "assistant") {
            if (msg.toolCalls && msg.toolCalls.length > 0) {
                return {
                    role: "assistant",
                    content: msg.content,
                    tool_calls: msg.toolCalls.map((tc) => ({
                        id: tc.id,
                        type: "function",
                        function: {
                            name: tc.name,
                            arguments: JSON.stringify(tc.params ?? {}),
                        },
                    })),
                };
            }
            return { role: "assistant", content: msg.content };
        }
        if (msg.role === "tool") {
            return {
                role: "tool",
                tool_call_id: msg.toolCallId,
                content: msg.content,
            };
        }
        return { role: msg.role, content: msg.content };
    });
}

type ToolCallAcc = { id: string; name: string; argsStr: string };

async function* parseStream(
    response: Response,
): AsyncIterable<ProviderRequestChunk> {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    let fullThought = "";
    let fullAnswer = "";
    // 按 tool_calls[].index 累积；OpenAI 把 arguments 拆成增量字符串跨 chunk 下发。
    const toolCallAccs = new Map<number, ToolCallAcc>();
    let finishReason: string | undefined;
    let usage: ProviderRequestChunk["usage"];

    const buildToolCalls = () => {
        const indices = [...toolCallAccs.keys()].sort((a, b) => a - b);
        return indices.map((idx) => {
            const acc = toolCallAccs.get(idx)!;
            let params: unknown = {};
            const trimmed = acc.argsStr.trim();
            if (trimmed) {
                try {
                    params = JSON.parse(trimmed);
                } catch (e) {
                    throw new Error(
                        `Invalid tool arguments for ${acc.name}: ${String(e)}`,
                    );
                }
            }
            return {
                id: acc.id || `call_${idx}`,
                name: acc.name || "unknown_tool",
                params,
            };
        });
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            buffer += done
                ? decoder.decode() + "\n"
                : decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
                const trimmedLine = line.trim();
                if (!trimmedLine || !trimmedLine.startsWith("data: ")) continue;

                const jsonStr = trimmedLine.slice(6);
                if (jsonStr === "[DONE]") continue;

                try {
                    const data = JSON.parse(jsonStr);
                    if (data?.error) throw new ProviderStreamError(data.error);
                    if (data.usage)
                        usage = {
                            inputTokens: data.usage.prompt_tokens,
                            outputTokens: data.usage.completion_tokens,
                        };
                    const choice = data.choices?.[0];
                    const delta = choice?.delta;

                    if (choice?.finish_reason) {
                        finishReason = choice.finish_reason;
                    }

                    const t = delta?.reasoning_content || "";
                    const a = delta?.content || "";
                    if (t) fullThought += t;
                    if (a) fullAnswer += a;

                    if (Array.isArray(delta?.tool_calls)) {
                        for (const tc of delta.tool_calls) {
                            const idx = tc.index ?? 0;
                            const acc = toolCallAccs.get(idx) ?? {
                                id: "",
                                name: "",
                                argsStr: "",
                            };
                            if (tc.id) acc.id = tc.id;
                            if (tc.function?.name) acc.name = tc.function.name;
                            if (tc.function?.arguments) {
                                acc.argsStr += tc.function.arguments;
                            }
                            toolCallAccs.set(idx, acc);
                        }
                    }

                    if (t || a || delta?.tool_calls?.length) {
                        const current = [...toolCallAccs.values()].at(-1);
                        yield {
                            thought: fullThought,
                            answer: fullAnswer,
                            ...(current?.name
                                ? {
                                      toolProgress: {
                                          id: current.id,
                                          name: current.name,
                                      },
                                  }
                                : {}),
                        };
                    }
                } catch (error) {
                    if (error instanceof ProviderStreamError) throw error;
                    console.warn("Failed to parse OpenAI SSE line:", error);
                }
            }
            if (done) break;
        }
    } finally {
        reader.releaseLock();
    }

    // 流结束：若有工具调用，连同 finishReason 一并产出最终 chunk。
    if (toolCallAccs.size > 0) {
        if (finishReason !== "tool_calls" && finishReason !== "stop") {
            yield {
                answer: fullAnswer,
                thought: fullThought,
                finishReason,
                usage,
                protocolError: {
                    code: "INCOMPLETE_TOOL_CALL",
                    message: `Tool output did not finish safely (finish_reason=${finishReason ?? "missing"}). No calls in this batch were executed. Retry with a smaller single call; split long code into smaller tasks.`,
                },
            };
            return;
        }
        try {
            yield {
                thought: fullThought,
                answer: fullAnswer,
                toolCalls: buildToolCalls(),
                finishReason,
                usage,
            };
        } catch {
            yield {
                answer: fullAnswer,
                thought: fullThought,
                finishReason,
                usage,
                protocolError: {
                    code: "INVALID_TOOL_ARGUMENTS",
                    message:
                        "Tool arguments are not valid JSON. No calls in this batch were executed. Correct the arguments and retry a smaller single call.",
                },
            };
        }
    } else if (finishReason) {
        yield { thought: fullThought, answer: fullAnswer, finishReason, usage };
    }
}

export const openAICompatibleAdapter: ProviderAdapter = {
    apiType: "open-ai-compatible",
    buildUrl(config) {
        return config.apiUrl.endsWith("/")
            ? `${config.apiUrl}chat/completions`
            : `${config.apiUrl}/chat/completions`;
    },
    buildHeaders(_config, apiKey) {
        return {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
        };
    },
    buildBody(
        config: AIConfig,
        messages: ChatMessage[],
        tools,
        options: BuildBodyOptions,
    ) {
        const body: Record<string, unknown> = {
            model: config.model,
            messages: toOpenAIMessages(messages),
            stream: true,
            temperature: options.temperature ?? 0.7,
            max_tokens: options.maxTokens ?? 8192,
        };
        if (tools.length > 0) {
            body.tools = tools.map((t) => ({
                type: "function",
                function: {
                    name: t.name,
                    description: t.describe,
                    parameters: toJsonSchema(t),
                },
            }));
            body.tool_choice = "auto";
        }
        return body;
    },
    parseStream,
};
