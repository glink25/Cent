import type { History } from "../../assistant";

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
