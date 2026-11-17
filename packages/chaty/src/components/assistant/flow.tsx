import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type {
    History,
    Message,
    RunActivity,
    Tool,
    ToolMessage,
} from "../../assistant";
import { useI18n } from "./i18n";
import { MessageBubble } from "./message";
import { thoughtTail, toolLabel, type turnPreview } from "./turn-model";

export function Thought({ text }: { text: string }) {
    const { t } = useI18n();
    return (
        <details className="text-muted-foreground text-sm">
            <summary className="cursor-pointer list-none flex items-center gap-2">
                <i className="icon-[mdi--thought-bubble-outline] size-4 shrink-0" />
                <span className="truncate">
                    {thoughtTail(text) || t("thought")}
                </span>
                <i className="icon-[mdi--chevron-down] size-4 shrink-0" />
            </summary>
            <div className="flow-detail mt-2 whitespace-pre-wrap">{text}</div>
        </details>
    );
}

export function ToolGroup({
    messages,
    tools,
}: {
    messages: ToolMessage[];
    tools: Tool[];
}) {
    const { t } = useI18n();
    const latest = messages.at(-1)!;
    const label = toolLabel(latest.formatted.name, tools);
    return (
        <details className="group/toolgroup min-w-0 text-muted-foreground text-sm">
            <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 hover:text-foreground [&::-webkit-details-marker]:hidden">
                <i className="icon-[mdi--console] size-4 shrink-0" />
                <span className="truncate">
                    {t("flowDone")} {label}
                </span>
                <span className="shrink-0 tabular-nums text-xs">
                    {messages.length}
                </span>
                <i className="icon-[mdi--chevron-down] size-4 shrink-0" />
            </summary>
            <div className="mt-2 space-y-1">
                {messages.map((message, index) => (
                    <MessageBubble
                        key={message.id ?? message.formatted.id ?? index}
                        message={message}
                        tools={tools}
                    />
                ))}
            </div>
        </details>
    );
}

export function Peek({
    activity,
    history,
    tools,
    fallback,
    approval,
}: {
    activity?: RunActivity;
    history: History;
    tools: Tool[];
    fallback?: string;
    approval?: boolean;
}) {
    const { t } = useI18n();
    const [display, setDisplay] = useState("");
    const lastUpdate = useRef(0);
    const message = history.find(
        (message) => message.id === activity?.messageId,
    );
    const thought =
        message?.role === "assistant" ? (message.formatted.thought ?? "") : "";
    const action = activity?.name ? toolLabel(activity.name, tools) : undefined;
    const phase = approval
        ? "approval"
        : fallback
          ? "status"
          : (activity?.phase ?? "thinking");
    const text = approval
        ? t("flowApproval")
        : fallback ||
          (action
              ? `${t(phase === "preparing" ? "flowPreparing" : "flowExecuting")} ${action}`
              : thoughtTail(thought) || t("flowThinking"));
    useEffect(() => {
        const update = () => {
            lastUpdate.current = Date.now();
            setDisplay(text);
        };
        const delay = Math.max(0, 150 - (Date.now() - lastUpdate.current));
        if (!delay) update();
        else {
            const timer = setTimeout(update, delay);
            return () => clearTimeout(timer);
        }
    }, [text]);
    if (phase === "answering") return null;
    return (
        <details
            key={`${phase}-${activity?.callId ?? activity?.messageId ?? ""}`}
            className="text-muted-foreground text-sm"
        >
            <summary className="flex cursor-pointer list-none items-start gap-2 [&::-webkit-details-marker]:hidden">
                <i
                    className={`${action ? "icon-[mdi--console]" : "icon-[mdi--thought-bubble-outline]"} mt-0.5 size-4 shrink-0`}
                />
                <span className="line-clamp-2 min-w-0 flow-peek">
                    {display || text}
                </span>
                <i className="icon-[mdi--chevron-down] size-4 shrink-0 mt-0.5" />
            </summary>
            <div className="flow-detail mt-2 whitespace-pre-wrap">
                {thought && phase === "thinking" && !action
                    ? thought
                    : activity?.params
                      ? JSON.stringify(activity.params, null, 2)
                      : text}
            </div>
        </details>
    );
}

const THOUGHT_UPDATE_MS = 400;

function PreviewThought({ text }: { text: string }) {
    const [display, setDisplay] = useState(text);
    const lastUpdate = useRef<number | undefined>(undefined);

    useEffect(() => {
        lastUpdate.current ??= performance.now();
        if (display === text) return;
        const delay = Math.max(
            0,
            THOUGHT_UPDATE_MS - (performance.now() - lastUpdate.current),
        );
        const timer = setTimeout(() => {
            lastUpdate.current = performance.now();
            setDisplay(text);
        }, delay);
        return () => clearTimeout(timer);
    }, [display, text]);

    return (
        <span key={display} className="flow-peek">
            {display}
        </span>
    );
}

export function PreviewStatus({
    preview,
    thoughtId,
}: {
    preview?: ReturnType<typeof turnPreview>;
    thoughtId?: string;
}) {
    const { t } = useI18n();
    const status = preview?.status ? t(preview.status) : "";
    const thinking = preview?.status === "flowThinking";
    const shimmering = thinking || preview?.status === "flowRunningTool";
    const tool = preview?.tool;
    const detail = preview?.completed
        ? `${t("flowDone")} ${preview.completed}`
        : tool;

    return (
        <div
            className={
                status
                    ? "flex min-w-0 items-center gap-2 whitespace-nowrap text-sm text-muted-foreground"
                    : "sr-only"
            }
        >
            <output className="sr-only">
                {tool ? `${status} ${tool}` : status}
            </output>
            {status && (
                <>
                    <span
                        key={status}
                        aria-hidden="true"
                        className={`flow-peek shrink-0${shimmering ? " flow-status-shimmer" : ""}`}
                    >
                        {status}
                    </span>
                    {(preview?.thought || detail) && (
                        <span
                            className={`min-w-0 truncate ${thinking ? "opacity-80" : ""}`}
                        >
                            {preview?.thought ? (
                                <PreviewThought
                                    key={thoughtId}
                                    text={preview.thought}
                                />
                            ) : (
                                <span key={detail} className="flow-peek">
                                    {detail}
                                </span>
                            )}
                        </span>
                    )}
                </>
            )}
        </div>
    );
}

type PreviewAnswerMessage = Extract<Message, { role: "assistant" }>;

function answerText(message: PreviewAnswerMessage) {
    return message.formatted.answer ?? message.raw;
}

export function PreviewAnswer({
    message,
    active,
    collapsed,
}: {
    message?: Message;
    active: boolean;
    collapsed: boolean;
}) {
    const answer = message?.role === "assistant" ? message : undefined;
    const previous = useRef<{ answer?: PreviewAnswerMessage; active: boolean }>(
        { active: false },
    );
    const [fade, setFade] = useState<{
        id?: string;
        revision: number;
        outgoing?: PreviewAnswerMessage;
    }>();

    useLayoutEffect(() => {
        const prior = previous.current;
        previous.current = { answer, active: active && collapsed };
        if (!answer || !collapsed) {
            setFade(undefined);
            return;
        }
        // The final answer can arrive in the same render that clears pending.
        if (
            (active || prior.active) &&
            (!prior.answer ||
                prior.answer.id !== answer.id ||
                !answerText(answer).startsWith(answerText(prior.answer)))
        ) {
            if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                setFade(undefined);
                return;
            }
            setFade((current) => ({
                id: answer.id,
                revision: (current?.revision ?? 0) + 1,
                outgoing: prior.answer,
            }));
        }
    }, [active, answer, collapsed]);

    const transition = collapsed && fade?.id === answer?.id ? fade : undefined;
    return answer ? (
        <div className="relative">
            {transition?.outgoing && (
                <div
                    key={transition.revision}
                    aria-hidden="true"
                    inert
                    className="flow-answer-out absolute inset-0 overflow-hidden"
                    onAnimationEnd={() =>
                        setFade((current) =>
                            current === transition
                                ? { ...current, outgoing: undefined }
                                : current,
                        )
                    }
                >
                    <MessageBubble message={transition.outgoing} hideThought />
                </div>
            )}
            <div
                key={`${answer.id ?? ""}-${transition?.revision ?? 0}`}
                className={transition ? "flow-answer-in" : undefined}
            >
                <MessageBubble message={answer} hideThought />
            </div>
        </div>
    ) : null;
}
