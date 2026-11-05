import { useEffect, useRef, useState } from "react";
import type { History, RunActivity, Tool, ToolMessage } from "../../assistant";
import { useI18n } from "./i18n";
import { MessageBubble } from "./message";
import { actionSummary, thoughtTail } from "./turn-model";

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
    const description = actionSummary(
        latest.formatted.name,
        latest.formatted.params,
        tools,
    );
    return (
        <details className="group/toolgroup min-w-0 text-muted-foreground text-sm">
            <summary className="flex min-w-0 cursor-pointer list-none items-center gap-2 hover:text-foreground [&::-webkit-details-marker]:hidden">
                <i className={`${description.icon} size-4 shrink-0`} />
                <span className="truncate">
                    {t("flowDone")} {description.label}
                    {description.summary ? ` · ${description.summary}` : ""}
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
    const action = activity?.name
        ? actionSummary(activity.name, activity.params, tools)
        : undefined;
    const phase = approval
        ? "approval"
        : fallback
          ? "status"
          : (activity?.phase ?? "thinking");
    const text = approval
        ? t("flowApproval")
        : fallback ||
          (action
              ? `${t(phase === "preparing" ? "flowPreparing" : "flowExecuting")} ${action.label}${action.summary ? ` · ${action.summary}` : ""}`
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
                    className={`${action?.icon ?? "icon-[mdi--thought-bubble-outline]"} mt-0.5 size-4 shrink-0`}
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
