import type {
    ChangeReceipt,
    ContextEvent,
    Message,
    ToolMessage,
} from "../../assistant";

export type Activity =
    | { kind: "message"; message: Message }
    | { kind: "tools"; tools: ToolMessage[] }
    | { kind: "context"; event: ContextEvent };
/** Keep commentary boundaries, but merge adjacent calls (including silent assistant call envelopes). */
export function turnActivity(
    messages: Message[],
    events: ContextEvent[] = [],
): Activity[] {
    const result: Activity[] = [];
    for (const message of messages) {
        if (message.role === "tool") {
            const previous = result.at(-1);
            if (previous?.kind === "tools") previous.tools.push(message);
            else result.push({ kind: "tools", tools: [message] });
        } else if (
            message.role !== "assistant" ||
            message.formatted.answer ||
            message.formatted.thought
        ) {
            result.push({ kind: "message", message });
        }
        for (const event of events) {
            if (event.anchorId === message.id)
                result.push({ kind: "context", event });
        }
    }
    return result;
}
export function toolLabel(message: ToolMessage): string {
    const params = message.formatted.params;
    if (
        params &&
        typeof params === "object" &&
        "code" in params &&
        typeof params.code === "string"
    ) {
        return `${message.formatted.name} · ${params.code.replace(/\s+/g, " ").slice(0, 100)}`;
    }
    return message.formatted.name;
}

export function changeReceiptFrom(value: unknown): ChangeReceipt | undefined {
    const returned = value as
        | (ChangeReceipt & { change?: ChangeReceipt })
        | undefined;
    const receipt =
        returned?.kind === "changeReceipt" ? returned : returned?.change;
    return receipt?.kind === "changeReceipt" && receipt.proposal?.diffs
        ? receipt
        : undefined;
}

export function turnReceipts(messages: Message[]) {
    const receipts = new Map<string, ChangeReceipt>();
    for (const message of messages) {
        if (message.role !== "tool") continue;
        const receipt = changeReceiptFrom(message.formatted.returns);
        if (
            receipt &&
            ["applied", "partial", "undone"].includes(receipt.status)
        ) {
            receipts.set(receipt.proposal.id, receipt);
        }
    }
    return [...receipts.values()];
}

/** Text previews are bounded display values. Original tool inputs stay intact. */
export function actionSummary(
    name: string,
    params: unknown,
    tools: import("../../assistant").Tool[] = [],
) {
    const display = tools.find((tool) => tool.name === name)?.display;
    let summary = "";
    try {
        summary = display?.summarize?.(params) ?? "";
    } catch {
        /* Optional host presentation. */
    }
    if (!summary && params && typeof params === "object") {
        const values = params as Record<string, unknown>;
        const value =
            values.id ??
            values.resource ??
            values.question ??
            values.filter ??
            values.code;
        summary =
            typeof value === "string"
                ? value
                : value
                  ? JSON.stringify(value)
                  : "";
    }
    return {
        label: display?.label ?? name,
        icon: display?.icon ?? "icon-[mdi--console]",
        summary: summary.replace(/\s+/g, " ").slice(0, 160),
    };
}

export function thoughtTail(text: string) {
    return text.trim().split(/\n+/).filter(Boolean).at(-1)?.slice(-180) ?? "";
}

export type FlowItem =
    | { kind: "thought"; id: string; text: string }
    | { kind: "answer"; id: string; message: Message }
    | { kind: "tools"; id: string; tools: ToolMessage[] }
    | { kind: "context"; id: string; event: ContextEvent };

export function projectFlow(
    messages: Message[],
    events: ContextEvent[],
): FlowItem[] {
    const flow: FlowItem[] = [];
    messages.forEach((message, index) => {
        const id = message.id ?? `legacy-${index}`;
        if (message.role === "assistant") {
            if (message.formatted.thought)
                flow.push({
                    kind: "thought",
                    id: `${id}-thought`,
                    text: message.formatted.thought,
                });
            if (message.formatted.answer)
                flow.push({ kind: "answer", id, message });
        } else if (message.role === "tool") {
            const previous = flow.at(-1);
            if (previous?.kind === "tools") previous.tools.push(message);
            else flow.push({ kind: "tools", id, tools: [message] });
        }
        for (const event of events) {
            if (event.anchorId === message.id)
                flow.push({ kind: "context", id: event.id, event });
        }
    });
    return flow;
}
