import { Collapsible } from "radix-ui";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
    ChangeProposal,
    ChangeReceipt,
    ContextEvent,
    History,
    Message,
    RunActivity,
    Tool,
} from "../../assistant";
import { ChangeCard, TurnChanges } from "./change-card";
import { Peek, Thought, ToolGroup } from "./flow";
import { useI18n } from "./i18n";
import { MessageBubble } from "./message";
import { projectFlow, turnReceipts } from "./turn-model";

type PendingApproval = {
    proposal: ChangeProposal;
    call?: { id: string; name: string };
    decide: (approved: boolean, remember?: boolean) => void;
};

export function groupTurns(history: History): Message[][] {
    const turns: Message[][] = [];
    for (const message of history) {
        if (
            message.role === "system" ||
            (message.role === "tool" && message.internal) ||
            (message.role === "assistant" &&
                /^(模型连续达到输出长度上限，任务尚未完成，已停止自动续接。|模型连续返回了不完整或无效的工具调用，已停止自动重试。)/.test(
                    message.raw,
                ))
        )
            continue;
        if (message.role === "user" || !turns.length) turns.push([]);
        turns[turns.length - 1].push(message);
    }
    return turns;
}
function ContextMarker({ event }: { event: ContextEvent }) {
    const { t } = useI18n();
    return event.summary ? (
        <details className="text-xs text-muted-foreground">
            <summary className="cursor-pointer">
                {t("contextCompacted")}
            </summary>
            <p className="mt-2 whitespace-pre-wrap break-words">
                {event.summary}
            </p>
        </details>
    ) : (
        <output
            className="flex items-center gap-2 text-xs text-muted-foreground"
            aria-live="polite"
        >
            <i className="icon-[mdi--loading] size-3 animate-spin" />
            {t("contextCompacting")}
        </output>
    );
}
function Turn({
    messages,
    active,
    activeTool,
    contextEvents,
    approval,
    undo,
    undoDisabled,
    activity: liveActivity,
    tools = [],
    startedAt,
    contextStatus,
}: {
    messages: Message[];
    activity?: RunActivity;
    tools?: Tool[];
    startedAt?: number;
    contextStatus?: string;
    approval?: PendingApproval;
    undo?: (receipt: ChangeReceipt) => Promise<void>;
    undoDisabled?: boolean;
    contextEvents: ContextEvent[];
    active: boolean;
    activeTool?: string;
}) {
    const { t } = useI18n();
    const [open, setOpen] = useState(false);
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!active) return;
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [active]);
    const user = messages[0]?.role === "user" ? messages[0] : undefined;
    const last = messages.at(-1);
    const final =
        last?.role === "assistant" &&
        !last.formatted.tools?.length &&
        (!active ||
            (last.formatted.answer &&
                (!liveActivity ||
                    (liveActivity.phase === "answering" &&
                        liveActivity.messageId === last.id))))
            ? last
            : undefined;
    const processRef = useRef<HTMLDivElement>(null);
    const followProcess = useRef(true);
    useLayoutEffect(() => {
        if (
            active &&
            messages.length &&
            followProcess.current &&
            processRef.current
        ) {
            processRef.current.scrollTop = processRef.current.scrollHeight;
        }
    }, [active, messages]);
    const process = messages.filter((m) => m !== user && m !== final);
    const flow = projectFlow(process, contextEvents).filter(
        (item) =>
            !(
                active &&
                liveActivity?.phase === "thinking" &&
                item.kind === "thought" &&
                item.id === `${liveActivity.messageId}-thought`
            ),
    );
    if (final?.role === "assistant" && final.formatted.thought) {
        flow.push({
            kind: "thought",
            id: `${final.id ?? "final"}-thought`,
            text: final.formatted.thought,
        });
    }
    const markersAfter = (message?: Message) =>
        message?.id
            ? contextEvents
                  .filter((event) => event.anchorId === message.id)
                  .map((event) => (
                      <ContextMarker key={event.id} event={event} />
                  ))
            : null;
    const duration = active
        ? now - (startedAt ?? user?.sentAt ?? now)
        : user?.elapsedMs;
    const seconds = Math.max(0, Math.floor((duration ?? 0) / 1000));
    const time =
        seconds < 60
            ? `${seconds}${t("agentSeconds")}`
            : `${Math.floor(seconds / 60)}${t("flowMinutes")} ${seconds % 60}${t("agentSeconds")}`;
    const fallback =
        contextStatus === "compacting"
            ? t("contextCompacting")
            : activeTool === "retrying_model_request"
              ? t("agentRetrying")
              : activeTool === "recovering_tool_call"
                ? t("agentRecovering")
                : undefined;
    const receipts = turnReceipts(messages);
    return (
        <section className="mx-auto w-full max-w-3xl shrink-0 space-y-5 py-4">
            {user && <MessageBubble message={user} />}
            {markersAfter(user)}
            {(flow.length > 0 || active || duration !== undefined) && (
                <Collapsible.Root open={open} onOpenChange={setOpen}>
                    <Collapsible.Trigger asChild>
                        <button
                            type="button"
                            aria-expanded={open}
                            disabled={!flow.length && !active}
                            className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground hover:text-foreground"
                        >
                            {duration !== undefined
                                ? `${t(active ? "flowElapsed" : "agentDuration")} ${time}`
                                : t("agentActivity")}
                            {user?.turnStatus === "cancelled" && (
                                <span>· {t("flowStopped")}</span>
                            )}
                            {user?.turnStatus === "failed" && (
                                <span>· {t("flowInterrupted")}</span>
                            )}
                            <i
                                className={`icon-[mdi--chevron-right] size-4 transition-transform ${open ? "rotate-90" : ""}`}
                            />
                        </button>
                    </Collapsible.Trigger>
                    <Collapsible.Content className="flow-process overflow-hidden">
                        <div
                            ref={processRef}
                            onScroll={(event) => {
                                const element = event.currentTarget;
                                followProcess.current =
                                    element.scrollHeight -
                                        element.scrollTop -
                                        element.clientHeight <
                                    60;
                            }}
                            className="mt-3 max-h-[min(50dvh,420px)] overflow-y-auto overscroll-contain space-y-5 pr-1 border-t pt-4"
                        >
                            {flow.map((item) =>
                                item.kind === "answer" ? (
                                    <MessageBubble
                                        key={item.id}
                                        message={item.message}
                                        hideThought
                                    />
                                ) : item.kind === "thought" ? (
                                    <Thought key={item.id} text={item.text} />
                                ) : item.kind === "context" ? (
                                    <ContextMarker
                                        key={item.id}
                                        event={item.event}
                                    />
                                ) : (
                                    <ToolGroup
                                        key={item.id}
                                        messages={item.tools}
                                        tools={tools}
                                    />
                                ),
                            )}
                            {active && open && !final && (
                                <Peek
                                    activity={liveActivity}
                                    history={messages}
                                    tools={tools}
                                    fallback={fallback}
                                    approval={!!approval}
                                />
                            )}
                        </div>
                    </Collapsible.Content>
                </Collapsible.Root>
            )}
            {final && (
                <MessageBubble key={final.id} message={final} hideThought />
            )}
            {active && !open && !final && (
                <Peek
                    activity={liveActivity}
                    history={messages}
                    tools={tools}
                    fallback={fallback}
                    approval={!!approval}
                    summaryOnly
                />
            )}
            {markersAfter(final)}
            {approval && (
                <div>
                    <ChangeCard
                        key={approval.proposal.id}
                        proposal={approval.proposal}
                        decide={approval.decide}
                    />
                </div>
            )}
            {!!receipts.length && (
                <TurnChanges
                    receipts={receipts}
                    undo={undo}
                    undoDisabled={undoDisabled}
                />
            )}
        </section>
    );
}
export function ConversationTurns({
    history,
    pending,
    activeTool,
    contextEvents = [],
    pendingContextEvent,
    approval,
    undo,
    undoDisabled,
    activity: liveActivity,
    tools = [],
    startedAt,
    contextStatus,
}: {
    history: History;
    activity?: RunActivity;
    tools?: Tool[];
    startedAt?: number;
    contextStatus?: string;
    approval?: PendingApproval;
    undo?: (receipt: ChangeReceipt) => Promise<void>;
    undoDisabled?: boolean;
    pending: boolean;
    activeTool?: string;
    contextEvents?: ContextEvent[];
    pendingContextEvent?: ContextEvent;
}) {
    const turns = groupTurns(history);
    const events = pendingContextEvent
        ? [...contextEvents, pendingContextEvent]
        : contextEvents;
    return (
        <>
            {turns.map((messages, index) => (
                <Turn
                    key={messages[0]?.id ?? index}
                    messages={messages}
                    approval={
                        pending &&
                        index === turns.length - 1 &&
                        (!approval?.call ||
                            messages.some(
                                (message) =>
                                    message.role === "assistant" &&
                                    message.formatted.tools?.some(
                                        (call) => call.id === approval.call?.id,
                                    ),
                            ))
                            ? approval
                            : undefined
                    }
                    activity={
                        index === turns.length - 1 ? liveActivity : undefined
                    }
                    tools={tools}
                    startedAt={startedAt}
                    contextStatus={contextStatus}
                    undo={undo}
                    undoDisabled={undoDisabled}
                    active={pending && index === turns.length - 1}
                    activeTool={
                        pending && index === turns.length - 1
                            ? activeTool
                            : undefined
                    }
                    contextEvents={events.filter((event) =>
                        messages.some(
                            (message) => message.id === event.anchorId,
                        ),
                    )}
                />
            ))}
        </>
    );
}
