import type {
    ChangeReceipt,
    ContextEvent,
    Message,
    RunActivity,
    Tool,
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

/** Host labels are plain text; Chaty owns presentation and phase translations. */
export function toolLabel(name: string, tools: Tool[] = []): string {
    const label = tools.find((tool) => tool.name === name)?.label;
    return label?.trim() ? label : name;
}

export function thoughtTail(text: string) {
    return text.trim().split(/\n+/).filter(Boolean).at(-1)?.slice(-180) ?? "";
}

function thoughtPreview(text: string) {
    const line = text.trim().replace(/\s+/g, " ");
    const sentence = line
        .match(/[^.!?。！？…]+(?:[.!?。！？…]+|$)/g)
        ?.findLast((part) => /[.!?。！？…]$/.test(part));
    return (sentence?.trim() || line).slice(-180);
}

type PreviewOverride =
    | "flowApproval"
    | "contextCompacting"
    | "agentRetrying"
    | "agentRecovering";

export function turnPreview(
    messages: Message[],
    activity: RunActivity | undefined,
    tools: Tool[],
    override?: PreviewOverride,
) {
    const answer = messages.findLast(
        (message) =>
            message.role === "assistant" && message.formatted.answer?.trim(),
    );
    if (override) return { answer, status: override };

    const current = activity?.messageId
        ? messages.find((message) => message.id === activity.messageId)
        : undefined;
    // The last provider chunk can already include parsed calls before execution starts.
    const parsedCall =
        activity?.phase === "answering" && current?.role === "assistant"
            ? current.formatted.tools?.[0]
            : undefined;
    const phase = parsedCall ? "preparing" : (activity?.phase ?? "thinking");
    const tool = parsedCall?.name ?? activity?.name;
    if (phase === "preparing" || phase === "executing") {
        return {
            answer,
            status:
                phase === "preparing"
                    ? ("flowPreparingTool" as const)
                    : ("flowRunningTool" as const),
            tool: tool ? toolLabel(tool, tools) : undefined,
        };
    }
    if (phase === "answering") return { answer, status: undefined };

    const thought =
        current?.role === "assistant"
            ? thoughtPreview(current.formatted.thought ?? "")
            : "";
    const completed = thought
        ? undefined
        : messages.findLast((message) => {
              if (
                  message.role !== "tool" ||
                  message.internal ||
                  message.formatted.errors !== undefined
              ) {
                  return false;
              }
              const receipt = changeReceiptFrom(message.formatted.returns);
              return !receipt || receipt.status === "applied";
          });
    return {
        answer,
        status: "flowThinking" as const,
        thought: thought || undefined,
        completed:
            completed?.role === "tool"
                ? toolLabel(completed.formatted.name, tools)
                : undefined,
    };
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
