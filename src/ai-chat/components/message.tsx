/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: <explanation> */
import { PlayIcon } from "lucide-react";
import { marked } from "marked";
import { Collapsible } from "radix-ui";
import { useIntl } from "@/locale";
import "./prose.css";
import type { Message } from "../core/type";

export function MessageBubble({
    message,
    onRerunToolCall,
}: {
    message: Message;
    onRerunToolCall?: () => void;
}) {
    const t = useIntl();
    switch (message.role) {
        case "user":
            return (
                <div className="flex justify-end">
                    <div className="border rounded-md p-2 max-w-[70%]">
                        <div className="whitespace-pre-wrap select-all">
                            {message.raw}
                        </div>
                        {message.assets?.[0] && (
                            <div className="flex flex-wrap gap-1 mt-2">
                                {message.assets.map((file, i) => (
                                    <span
                                        key={i}
                                        className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1"
                                    >
                                        <span>📎</span>
                                        <span className="truncate max-w-20">
                                            {file.name}
                                        </span>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            );

        case "assistant":
            return (
                <div className="flex justify-start">
                    <div className="rounded-md p-2 w-full">
                        {message.formatted.thought && (
                            <details className="text-xs opacity-60 mb-2">
                                <summary className="sticky top-0 z-10 bg-background shadow-[0_-8px_0_0_var(--background)] cursor-pointer">
                                    {t("thought")}
                                </summary>
                                <div className="mt-1 whitespace-pre-wrap select-all">
                                    {message.formatted.thought}
                                </div>
                            </details>
                        )}
                        <div
                            className="prose prose-sm max-w-none select-all"
                            dangerouslySetInnerHTML={{
                                __html: marked.parse(
                                    message.formatted.answer || message.raw,
                                    { async: false },
                                ),
                            }}
                        />
                    </div>
                </div>
            );

        case "tool": {
            const { name } = message.formatted;
            return (
                <Collapsible.Root className="bg-muted/50 rounded-md p-2 text-xs select-all">
                    <div className="flex items-center justify-between w-full gap-1">
                        <Collapsible.Trigger className="flex items-center gap-2 flex-1 cursor-pointer hover:bg-accent/50 p-1 rounded min-w-0">
                            <span>🔧</span>
                            <span className="font-medium truncate">{name}</span>
                            {message.formatted.runningTime !== undefined && (
                                <span className="opacity-60 text-[10px] shrink-0">
                                    {message.formatted.runningTime}ms
                                </span>
                            )}
                        </Collapsible.Trigger>
                        {message.formatted.name === "playground" &&
                            onRerunToolCall && (
                                <button
                                    type="button"
                                    title="re-run tool call"
                                    aria-label="re-run tool call"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onRerunToolCall();
                                    }}
                                    className="shrink-0 p-1 rounded hover:bg-accent/50 cursor-pointer text-muted-foreground hover:text-foreground"
                                >
                                    <PlayIcon className="size-3.5" />
                                </button>
                            )}
                    </div>
                    <Collapsible.Content className="overflow-hidden mt-2 space-y-1 data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close">
                        <div>
                            <strong>参数:</strong>
                            <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">
                                {JSON.stringify(
                                    message.formatted.params,
                                    null,
                                    2,
                                )}
                            </pre>
                        </div>
                        {Boolean(message.formatted.returns) && (
                            <div>
                                <strong>返回:</strong>
                                <pre className="mt-1 p-2 bg-background rounded text-[10px] overflow-x-auto">
                                    {JSON.stringify(
                                        message.formatted.returns,
                                        null,
                                        2,
                                    )}
                                </pre>
                            </div>
                        )}
                        {Boolean(message.formatted.errors) && (
                            <div className="text-destructive">
                                <strong>错误:</strong>
                                {JSON.stringify(
                                    message.formatted.errors,
                                    null,
                                    2,
                                )}
                            </div>
                        )}
                    </Collapsible.Content>
                </Collapsible.Root>
            );
        }

        default:
            return null;
    }
}
