import type {
    History,
    Provider,
    ProviderRequestChunk,
    ProviderToolCall,
} from "../../../assistant";
import { withAbort } from "../../../assistant/shared";

const PLACEHOLDER_ANSWER = "AI provider is not configured in this UI shell.";

function getLastUserMessage(history: History) {
    return history.findLast((message) => message.role === "user");
}

/**
 * 调试辅助：把用户文本里的 `<tool>{"name":...,"params":{}}</tool>` 翻译为原生
 * tool_calls，模拟真实模型「决定调用工具」的行为。真实 host 由底层 API 返回
 * 原生 tool_calls，这里只是无 host 时的本地替身。
 */
function extractToolCalls(text: string): ProviderToolCall[] {
    const calls: ProviderToolCall[] = [];
    const regex = /<tool>([\s\S]*?)<\/tool>/g;
    let match: RegExpExecArray | null;
    let index = 0;
    match = regex.exec(text);
    while (match !== null) {
        try {
            const parsed = JSON.parse(match[1].trim());
            calls.push({
                id: `call_${index}`,
                name: parsed.name ?? "unknown_tool",
                params: parsed.params ?? {},
            });
        } catch {
            // 忽略无法解析的 tool 块
        }
        index += 1;
        match = regex.exec(text);
    }
    return calls;
}

function getLastToolMessage(history: History) {
    return history.findLast((message) => message.role === "tool");
}

function buildToolSummary(history: History) {
    const toolMessage = getLastToolMessage(history);
    if (!toolMessage) {
        return PLACEHOLDER_ANSWER;
    }
    const { name, returns, errors } = toolMessage.formatted;
    if (errors !== undefined) {
        return `Tool ${name} failed:\n\n${JSON.stringify(errors, null, 2)}`;
    }
    return `Tool ${name} returned:\n\n${JSON.stringify(returns, null, 2)}`;
}

async function* createSingleChunk(
    chunk: ProviderRequestChunk,
): AsyncIterable<ProviderRequestChunk> {
    yield chunk;
}

export const ShellAIProvider: Provider = {
    request: ({ history }) => {
        const controller = new AbortController();
        const run = async () => {
            if (controller.signal.aborted) {
                throw new DOMException("Aborted", "AbortError");
            }

            const lastMessage = history[history.length - 1];
            if (lastMessage?.role === "tool") {
                return createSingleChunk({
                    answer: buildToolSummary(history),
                });
            }

            const raw = getLastUserMessage(history)?.raw ?? "";
            const toolCalls = extractToolCalls(raw);
            if (toolCalls.length > 0) {
                return createSingleChunk({
                    answer: "",
                    toolCalls,
                    finishReason: "tool_calls",
                });
            }
            return createSingleChunk({
                answer: `<overview>AI Chat</overview>${PLACEHOLDER_ANSWER}`,
            });
        };

        return withAbort(run(), () => controller.abort());
    },
};
