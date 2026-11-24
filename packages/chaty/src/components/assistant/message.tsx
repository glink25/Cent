/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: Markdown is rendered from local chat text in this UI shell. */
import { recordStreamTiming } from "@glink25/agent-core/assistant/stream-scheduling";
import DOMPurify from "dompurify";
import { Marked } from "marked";
import { Collapsible } from "radix-ui";
import { memo, useId, useLayoutEffect, useRef, useState } from "react";
import "./prose.css";
import type { Message, Tool } from "@glink25/agent-core";
import { useCopyText } from "./clipboard";
import { useI18n } from "./i18n";
import { toolLabel } from "./turn-model";

const markdownCache = new Map<string, string>();
let cachedCharacters = 0;

function escapeHtml(text: string) {
    return text
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

const markdown = new Marked({
    renderer: {
        code({ text, lang }) {
            const language = lang?.match(/\S+/)?.[0];
            const className = language
                ? ` class="language-${escapeHtml(language)}"`
                : "";
            return `<pre><code${className}>${escapeHtml(text)}</code></pre>\n`;
        },
    },
});

function renderMarkdown(text: string) {
    const cached = markdownCache.get(text);
    if (cached !== undefined) return cached;
    const started = performance.now();
    const html = DOMPurify.sanitize(markdown.parse(text, { async: false }));
    recordStreamTiming("markdown", text.length, {
        duration: performance.now() - started,
    });
    const size = text.length + html.length;
    if (size > 1_000_000) return html;
    while (markdownCache.size >= 64 || cachedCharacters + size > 1_000_000) {
        const oldest = markdownCache.entries().next().value;
        if (!oldest) break;
        markdownCache.delete(oldest[0]);
        cachedCharacters -= oldest[0].length + oldest[1].length;
    }
    markdownCache.set(text, html);
    cachedCharacters += size;
    return html;
}

function MarkdownAnswer({ text }: { text: string }) {
    const { t } = useI18n();
    const copy = useCopyText();
    const body = useRef<HTMLDivElement>(null);
    const html = renderMarkdown(text);
    const label = t("flowCopyCode");

    useLayoutEffect(() => {
        const root = body.current;
        if (!root || !html) return;
        const wrappers = Array.from(
            root.querySelectorAll("pre > code"),
            (code) => {
                const pre = code.parentElement;
                if (!pre) return;
                const wrapper = document.createElement("div");
                wrapper.className = "chaty-code-block";
                const button = document.createElement("button");
                button.type = "button";
                button.className = "chaty-code-copy";
                button.title = label;
                button.setAttribute("aria-label", label);
                const icon = document.createElement("i");
                icon.className = "icon-[mdi--content-copy] size-4";
                icon.setAttribute("aria-hidden", "true");
                button.append(icon);
                button.onclick = () => void copy(code.textContent ?? "");
                pre.before(wrapper);
                wrapper.append(button, pre);
                return { wrapper, pre };
            },
        );
        return () => {
            for (const entry of wrappers) {
                if (entry && root.contains(entry.wrapper)) {
                    entry.wrapper.replaceWith(entry.pre);
                }
            }
        };
    }, [html, label, copy]);

    return (
        <div
            ref={body}
            className="prose max-w-none select-text text-[15px] leading-7"
            dangerouslySetInnerHTML={{ __html: html }}
        />
    );
}

const actionClass =
    "grid size-9 place-items-center rounded cursor-pointer hover:bg-muted hover:text-foreground disabled:cursor-default disabled:opacity-40";

export function ReplyActions({
    message,
    onBranch,
    branchDisabled,
}: {
    message: Extract<Message, { role: "assistant" }>;
    onBranch?: (message: Message) => void;
    branchDisabled?: boolean;
}) {
    const { t } = useI18n();
    const copy = useCopyText();
    return (
        <div className="flex items-center gap-1 text-muted-foreground">
            <button
                type="button"
                aria-label={t("flowCopyAnswer")}
                title={t("flowCopyAnswer")}
                className={actionClass}
                onClick={() =>
                    void copy(message.formatted.answer ?? message.raw)
                }
            >
                <i
                    aria-hidden="true"
                    className="icon-[mdi--content-copy] size-4"
                />
            </button>
            {onBranch && (
                <button
                    type="button"
                    aria-label={t("flowBranch")}
                    title={t("flowBranch")}
                    className={actionClass}
                    disabled={branchDisabled}
                    onClick={() => onBranch(message)}
                >
                    <i
                        aria-hidden="true"
                        className="icon-[mdi--source-branch] size-4"
                    />
                </button>
            )}
        </div>
    );
}

const USER_MESSAGE_MAX_HEIGHT = 240;

function UserMessageBody({ text }: { text: string }) {
    const { t } = useI18n();
    const bodyId = useId();
    const bodyRef = useRef<HTMLDivElement>(null);
    const [expanded, setExpanded] = useState(false);
    const [overflowing, setOverflowing] = useState(false);

    useLayoutEffect(() => {
        const body = bodyRef.current;
        if (!body) return;

        const measure = () => {
            // Observe the natural body, never the clipped viewport.
            const overflows =
                body.getBoundingClientRect().height > USER_MESSAGE_MAX_HEIGHT;
            setOverflowing(overflows);
            if (!overflows) setExpanded(false);
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(body);
        return () => observer.disconnect();
    }, []);

    return (
        <>
            <div
                id={bodyId}
                style={{
                    maxHeight: expanded ? undefined : USER_MESSAGE_MAX_HEIGHT,
                    overflow: expanded ? undefined : "hidden",
                }}
            >
                <div
                    ref={bodyRef}
                    className="whitespace-pre-wrap [overflow-wrap:anywhere] select-all"
                >
                    {text}
                </div>
            </div>
            {overflowing && (
                <button
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={bodyId}
                    className="mt-2 inline-flex items-center gap-1 rounded px-1 text-sm text-inherit focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-current cursor-pointer"
                    onClick={() => setExpanded((value) => !value)}
                >
                    {t(expanded ? "userMessageCollapse" : "userMessageExpand")}
                    <i
                        aria-hidden="true"
                        className={`size-4 ${expanded ? "icon-[mdi--chevron-up]" : "icon-[mdi--chevron-down]"}`}
                    />
                </button>
            )}
        </>
    );
}

export const MessageBubble = memo(function MessageBubble({
    message,
    onRerunToolCall,
    hideThought,
    tools = [],
}: {
    message: Message;
    hideThought?: boolean;
    tools?: Tool[];
    onRerunToolCall?: () => void;
}) {
    const { t } = useI18n();
    const copy = useCopyText();

    switch (message.role) {
        case "user":
            return (
                <div className="flex flex-col items-end gap-2">
                    <div className="min-w-0 bg-blue-50 text-slate-900 dark:bg-slate-800 dark:text-slate-100 rounded-3xl px-4 py-3 max-w-[85%]">
                        <UserMessageBody key={message.raw} text={message.raw} />
                        {!!message.references?.length && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {message.references.map((ref) => (
                                    <span
                                        key={JSON.stringify([ref.type, ref.id])}
                                        className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1"
                                    >
                                        <i className="icon-[mdi--link-variant] size-4" />
                                        {ref.label}
                                    </span>
                                ))}
                            </div>
                        )}
                        {message.assets?.[0] && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {message.assets.map((file) => (
                                    <span
                                        key={`${file.name}-${file.lastModified}-${file.size}`}
                                        className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1"
                                    >
                                        <i className="icon-[mdi--paperclip] size-3.5"></i>
                                        <span className="truncate max-w-20">
                                            {file.name}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {message.sentAt && (
                            <time
                                dateTime={new Date(
                                    message.sentAt,
                                ).toISOString()}
                            >
                                {new Date(message.sentAt).toLocaleTimeString(
                                    [],
                                    { hour: "2-digit", minute: "2-digit" },
                                )}
                            </time>
                        )}
                        <button
                            type="button"
                            aria-label={t("flowCopy")}
                            title={t("flowCopy")}
                            className={actionClass}
                            onClick={() => void copy(message.raw)}
                        >
                            <i
                                aria-hidden="true"
                                className="icon-[mdi--content-copy] size-4"
                            />
                        </button>
                    </div>
                </div>
            );

        case "assistant":
            return (
                <div className="flex justify-start">
                    <div className="min-w-0 w-full">
                        {!hideThought && message.formatted.thought && (
                            <details className="text-xs opacity-60 mb-2">
                                <summary className="sticky top-0 z-10 bg-background shadow-[0_-8px_0_0_var(--background)] cursor-pointer">
                                    {t("thought")}
                                </summary>
                                <div className="mt-1 whitespace-pre-wrap break-words select-all">
                                    {message.formatted.thought}
                                </div>
                            </details>
                        )}
                        <MarkdownAnswer
                            text={message.formatted.answer ?? message.raw}
                        />
                    </div>
                </div>
            );

        case "tool": {
            const { name } = message.formatted;
            const label = toolLabel(name, tools);
            return (
                <Collapsible.Root className="min-w-0 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between w-full gap-1">
                        <Collapsible.Trigger className="group/call flex items-center gap-2 flex-1 cursor-pointer hover:text-foreground py-1 rounded min-w-0">
                            <i className="icon-[mdi--console] size-4 shrink-0"></i>
                            <span className="font-medium truncate">
                                {message.formatted.errors !== undefined
                                    ? t("error")
                                    : t("flowDone")}{" "}
                                {label}
                            </span>
                            {message.formatted.runningTime !== undefined && (
                                <span className="opacity-60 text-[10px] shrink-0">
                                    {message.formatted.runningTime}ms
                                </span>
                            )}
                            <i className="icon-[mdi--chevron-right] size-4 shrink-0 transition-transform group-data-[state=open]/call:rotate-90" />
                        </Collapsible.Trigger>
                        {name === "playground" && onRerunToolCall && (
                            <button
                                type="button"
                                title={t("rerunToolCall")}
                                aria-label={t("rerunToolCall")}
                                onClick={(event) => {
                                    event.stopPropagation();
                                    onRerunToolCall();
                                }}
                                className="shrink-0 p-1 rounded hover:bg-accent/50 cursor-pointer text-muted-foreground hover:text-foreground"
                            >
                                <i className="icon-[mdi--play] size-3.5"></i>
                            </button>
                        )}
                    </div>
                    <Collapsible.Content className="flow-detail mt-2 space-y-3 data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close motion-reduce:animate-none">
                        <div>
                            <strong>{t("params")}:</strong>
                            <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                                {message.formatted.params &&
                                typeof message.formatted.params === "object" &&
                                "code" in message.formatted.params
                                    ? String(message.formatted.params.code)
                                    : JSON.stringify(
                                          message.formatted.params,
                                          null,
                                          2,
                                      )}
                            </pre>
                        </div>
                        {message.formatted.returns !== undefined && (
                            <div>
                                <strong>{t("returns")}:</strong>
                                <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                                    {JSON.stringify(
                                        message.formatted.returns,
                                        null,
                                        2,
                                    )}
                                </pre>
                            </div>
                        )}
                        {message.formatted.errors !== undefined && (
                            <div className="text-destructive">
                                <strong>{t("error")}:</strong>
                                <pre className="mt-1 whitespace-pre-wrap break-all text-xs">
                                    {JSON.stringify(
                                        message.formatted.errors,
                                        null,
                                        2,
                                    )}
                                </pre>
                            </div>
                        )}
                    </Collapsible.Content>
                </Collapsible.Root>
            );
        }

        default:
            return null;
    }
});
