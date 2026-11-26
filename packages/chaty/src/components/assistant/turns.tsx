import { Collapsible } from "radix-ui";
import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
    ChangeProposal,
    ChangeReceipt,
    ContextEvent,
    History,
    Message,
    RunActivity,
    Tool,
    ToolAuthorizationRequest,
} from "../../assistant";
import { ChangeCard, TurnChanges } from "./change-card";
import { Peek, PreviewAnswer, PreviewStatus, Thought, ToolGroup } from "./flow";
import { useI18n } from "./i18n";
import { MessageBubble, ReplyActions } from "./message";
import { projectFlow, turnPreview, turnReceipts } from "./turn-model";

export type PendingApproval = {
    proposal: ChangeProposal | ToolAuthorizationRequest;
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
const Turn = memo(
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
        onBranch,
        branchDisabled,
    }: {
        messages: Message[];
        activity?: RunActivity;
        tools?: Tool[];
        startedAt?: number;
        contextStatus?: string;
        onBranch?: (message: Message) => void;
        branchDisabled?: boolean;
        approval?: PendingApproval;
        undo?: (receipt: ChangeReceipt) => Promise<void>;
        undoDisabled?: boolean;
        contextEvents: ContextEvent[];
        active: boolean;
        activeTool?: string;
    }) {
        const { t } = useI18n();
        const [open, setOpen] = useState(false);
        const user = messages[0]?.role === "user" ? messages[0] : undefined;
        const last = messages.at(-1);
        const final =
            last?.role === "assistant" &&
            !last.formatted.tools?.length &&
            (active
                ? last.formatted.answer?.trim() &&
                  (!liveActivity ||
                      (liveActivity.phase === "answering" &&
                          liveActivity.messageId === last.id))
                : (last.formatted.answer ?? last.raw).trim())
                ? last
                : undefined;
        const processRef = useRef<HTMLDivElement>(null);
        const followProcess = useRef(true);
        useLayoutEffect(() => {
            if (
                !open ||
                !messages.length ||
                !followProcess.current ||
                !processRef.current
            )
                return;
            const frame = requestAnimationFrame(() => {
                if (followProcess.current && processRef.current) {
                    processRef.current.scrollTop =
                        processRef.current.scrollHeight;
                }
            });
            return () => cancelAnimationFrame(frame);
        }, [open, messages]);
        const process = open
            ? messages.filter((m) => m !== user && m !== final)
            : [];
        const flow = projectFlow(process, contextEvents).filter(
            (item) =>
                !(
                    active &&
                    liveActivity?.phase === "thinking" &&
                    item.kind === "thought" &&
                    item.id === `${liveActivity.messageId}-thought`
                ),
        );
        if (open && final?.role === "assistant" && final.formatted.thought) {
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
        const hasDuration = active || user?.elapsedMs !== undefined;
        const hasProcess =
            contextEvents.length > 0 ||
            messages.some(
                (message) =>
                    message !== user &&
                    message !== final &&
                    (message.role === "tool" ||
                        (message.role === "assistant" &&
                            (message.formatted.answer ||
                                message.formatted.thought ||
                                message.formatted.tools?.length))),
            ) ||
            (final?.role === "assistant" && !!final.formatted.thought);
        const fallbackStatus =
            contextStatus === "compacting"
                ? "contextCompacting"
                : activeTool === "retrying_model_request"
                  ? "agentRetrying"
                  : activeTool === "recovering_tool_call"
                    ? "agentRecovering"
                    : undefined;
        const preview =
            active && !open
                ? turnPreview(
                      messages,
                      liveActivity,
                      tools,
                      approval ? "flowApproval" : fallbackStatus,
                  )
                : undefined;
        const outerAnswer = final ?? preview?.answer;
        const receipts = turnReceipts(messages);
        return (
            <section className="mx-auto w-full max-w-3xl shrink-0 space-y-4 py-4">
                {user && <MessageBubble message={user} />}
                {markersAfter(user)}
                {(hasProcess || hasDuration) && (
                    <Collapsible.Root open={open} onOpenChange={setOpen}>
                        <Collapsible.Trigger asChild>
                            <button
                                type="button"
                                aria-expanded={open}
                                disabled={!hasProcess && !active}
                                className="flex items-center gap-1.5 py-1 text-sm text-muted-foreground hover:text-foreground"
                            >
                                <TurnDuration
                                    active={active}
                                    startedAt={startedAt ?? user?.sentAt}
                                    elapsedMs={user?.elapsedMs}
                                />
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
                        {/* Skip the exit animation when the answer moves outside the timeline. */}
                        <Collapsible.Content
                            className={
                                preview?.answer
                                    ? "overflow-hidden"
                                    : "flow-process overflow-hidden"
                            }
                        >
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
                                        <Thought
                                            key={item.id}
                                            text={item.text}
                                        />
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
                                        fallback={
                                            fallbackStatus && t(fallbackStatus)
                                        }
                                        approval={!!approval}
                                    />
                                )}
                            </div>
                        </Collapsible.Content>
                    </Collapsible.Root>
                )}
                {active && (
                    <PreviewStatus
                        preview={preview}
                        thoughtId={liveActivity?.messageId}
                    />
                )}
                {approval && (
                    <div>
                        <ChangeCard
                            key={approval.proposal.id}
                            proposal={approval.proposal}
                            decide={approval.decide}
                        />
                    </div>
                )}
                <PreviewAnswer
                    message={outerAnswer}
                    active={active}
                    collapsed={!open}
                />
                {!active &&
                    final &&
                    user?.turnStatus !== "cancelled" &&
                    user?.turnStatus !== "failed" && (
                        <ReplyActions
                            message={final}
                            onBranch={onBranch}
                            branchDisabled={branchDisabled}
                        />
                    )}
                {markersAfter(final)}
                {!!receipts.length && (
                    <TurnChanges
                        receipts={receipts}
                        undo={undo}
                        undoDisabled={undoDisabled}
                    />
                )}
            </section>
        );
    },
    (previous, next) => {
        const {
            messages: oldMessages,
            contextEvents: oldEvents,
            ...oldProps
        } = previous;
        const { messages, contextEvents, ...props } = next;
        return (
            oldMessages.length === messages.length &&
            oldMessages.every(
                (message, index) => message === messages[index],
            ) &&
            oldEvents.length === contextEvents.length &&
            oldEvents.every((event, index) => event === contextEvents[index]) &&
            (Object.keys(props) as (keyof typeof props)[]).every(
                (key) => props[key] === oldProps[key],
            )
        );
    },
);

function TurnDuration({
    active,
    startedAt,
    elapsedMs,
}: {
    active: boolean;
    startedAt?: number;
    elapsedMs?: number;
}) {
    const { t } = useI18n();
    const [now, setNow] = useState(Date.now());
    useEffect(() => {
        if (!active) return;
        setNow(Date.now());
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [active]);
    if (!active && elapsedMs === undefined) return <>{t("agentActivity")}</>;
    const seconds = Math.max(
        0,
        Math.floor(
            (active ? now - (startedAt ?? now) : (elapsedMs ?? 0)) / 1000,
        ),
    );
    const time =
        seconds < 60
            ? `${seconds}${t("agentSeconds")}`
            : `${Math.floor(seconds / 60)}${t("flowMinutes")} ${seconds % 60}${t("agentSeconds")}`;
    return (
        <>
            {t(active ? "flowElapsed" : "agentDuration")} {time}
        </>
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
    onBranch,
    branchDisabled,
}: {
    history: History;
    activity?: RunActivity;
    tools?: Tool[];
    startedAt?: number;
    contextStatus?: string;
    onBranch?: (message: Message) => void;
    branchDisabled?: boolean;
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
                    onBranch={onBranch}
                    branchDisabled={branchDisabled}
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
                    startedAt={
                        index === turns.length - 1 ? startedAt : undefined
                    }
                    contextStatus={
                        index === turns.length - 1 ? contextStatus : undefined
                    }
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
