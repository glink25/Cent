/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: <explanation> */
import { Collapsible } from "radix-ui";
import snarkdown from "snarkdown";
import type { Message } from "./core/type";

export function MessageBubble({ message }: { message: Message }) {
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
                    <div className="border rounded-md p-2 bg-muted max-w-[70%] overflow-auto">
                        {message.formatted.thought && (
                            <details className="text-xs opacity-60 mb-2">
                                <summary className="cursor-pointer hover:opacity-80">
                                    思考过程
                                </summary>
                                <div className="mt-1 whitespace-pre-wrap select-all">
                                    {message.formatted.thought}
                                </div>
                            </details>
                        )}
                        <div
                            className="prose prose-sm max-w-none select-all"
                            dangerouslySetInnerHTML={{
                                __html: snarkdown(
                                    message.formatted.answer || message.raw,
                                ),
                            }}
                        />
                    </div>
                </div>
            );

        case "tool":
            return (
                <Collapsible.Root className="bg-muted/50 rounded-md p-2 text-xs select-all">
                    <Collapsible.Trigger className="flex items-center justify-between w-full cursor-pointer hover:bg-accent/50 p-1 rounded">
                        <div className="flex items-center gap-2">
                            <span>🔧</span>
                            <span className="font-medium">
                                {message.formatted.name}
                            </span>
                        </div>
                        {message.formatted.runningTime && (
                            <span className="opacity-60 text-[10px]">
                                {message.formatted.runningTime}ms
                            </span>
                        )}
                    </Collapsible.Trigger>
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

        default:
            return null;
    }
}
