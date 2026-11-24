import { validContextState } from "@glink25/agent-core/assistant/context";
import type { History, Message } from "../../assistant";
import type { Chat } from "./state";

export function branchConversation(
    source: Chat,
    reply: Message,
    id: string,
): Chat | undefined {
    if (source.pending || reply.role !== "assistant") return;
    const index = source.history.indexOf(reply);
    if (index < 0) return;
    const history = source.history.slice(0, index + 1);
    const ids = new Set(history.map((message) => message.id));
    return {
        id,
        scope: source.scope,
        history,
        isBranch: true,
        contextState: validContextState(history, source.contextState),
        contextEvents: source.contextEvents?.filter(
            (event) =>
                ids.has(event.anchorId) &&
                (!event.coveredThroughId || ids.has(event.coveredThroughId)),
        ),
    };
}

export function conversationTitle(history: History, fallback: string): string {
    const first = history.find((message) => message.role === "user");
    const text = first?.raw.trim().replace(/\s+/g, " ") ?? "";
    if (!text) return fallback;
    const chars = Array.from(text);
    return chars.length > 40 ? `${chars.slice(0, 40).join("")}…` : text;
}
export function hasCurrentResponse(history: History): boolean {
    const start = history.findLastIndex((message) => message.role === "user");
    return history
        .slice(start + 1)
        .some(
            (message) =>
                message.role === "assistant" || message.role === "tool",
        );
}
