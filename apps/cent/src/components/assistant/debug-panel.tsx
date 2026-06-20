import { useMemo, useState } from "react";
import { Button } from "../ui/button";
import { type ToolLogEntry, useDebugLogStore } from "./debug-log";

function StatusBadge({ status }: { status: ToolLogEntry["status"] }) {
    const color =
        status === "running"
            ? "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300"
            : status === "success"
              ? "bg-green-500/20 text-green-700 dark:text-green-300"
              : "bg-red-500/20 text-red-700 dark:text-red-300";
    return (
        <span className={`px-1.5 py-0.5 rounded text-[10px] ${color}`}>
            {status}
        </span>
    );
}

function Entry({ entry }: { entry: ToolLogEntry }) {
    const [open, setOpen] = useState(false);
    const duration =
        entry.endedAt !== undefined ? entry.endedAt - entry.startedAt : null;
    return (
        <div className="border rounded p-1.5 bg-background">
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="w-full flex items-center gap-2 text-left cursor-pointer hover:bg-accent/40 rounded px-1 py-0.5"
            >
                <i
                    className={`size-3 ${
                        open
                            ? "icon-[mdi--chevron-down]"
                            : "icon-[mdi--chevron-right]"
                    }`}
                ></i>
                <span className="font-mono text-xs flex-1 truncate">
                    {entry.name}
                </span>
                <StatusBadge status={entry.status} />
                {duration !== null && (
                    <span className="opacity-60 text-[10px]">{duration}ms</span>
                )}
            </button>
            {open && (
                <div className="mt-1 space-y-1 px-1">
                    <div>
                        <div className="text-[10px] opacity-60">params</div>
                        <pre className="bg-muted rounded p-1 text-[10px] overflow-x-auto select-text whitespace-pre-wrap break-all">
                            {JSON.stringify(entry.params, null, 2)}
                        </pre>
                    </div>
                    {entry.status === "success" && (
                        <div>
                            <div className="text-[10px] opacity-60">result</div>
                            <pre className="bg-muted rounded p-1 text-[10px] overflow-x-auto select-text whitespace-pre-wrap break-all">
                                {JSON.stringify(entry.result, null, 2)}
                            </pre>
                        </div>
                    )}
                    {entry.status === "error" && (
                        <div>
                            <div className="text-[10px] opacity-60 text-destructive">
                                error
                            </div>
                            <pre className="bg-destructive/10 text-destructive rounded p-1 text-[10px] overflow-x-auto select-text whitespace-pre-wrap break-all">
                                {entry.error}
                            </pre>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export function DebugLogPanel() {
    const open = useDebugLogStore((s) => s.panelOpen);
    const setOpen = useDebugLogStore((s) => s.setPanelOpen);
    const entries = useDebugLogStore((s) => s.entries);
    const clear = useDebugLogStore((s) => s.clear);
    const reversed = useMemo(() => [...entries].reverse(), [entries]);
    const runningCount = entries.filter((e) => e.status === "running").length;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(!open)}
                className="absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full border bg-background px-2 py-1 text-[10px] shadow hover:bg-accent cursor-pointer"
                title="Tool log"
            >
                <i className="icon-[mdi--bug-outline] size-3.5"></i>
                <span>log</span>
                {entries.length > 0 && (
                    <span className="bg-muted rounded-full px-1.5">
                        {entries.length}
                    </span>
                )}
                {runningCount > 0 && (
                    <span className="size-1.5 rounded-full bg-yellow-500 animate-pulse" />
                )}
            </button>
            {open && (
                <div className="absolute top-10 left-2 right-2 z-20 max-h-[55%] bg-background border rounded-md shadow-lg flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-2 py-1 border-b">
                        <div className="text-xs font-medium">
                            Tool log ({entries.length})
                        </div>
                        <div className="flex gap-1">
                            <Button
                                variant="ghost"
                                className="h-6 px-2 text-xs"
                                onClick={clear}
                            >
                                clear
                            </Button>
                            <Button
                                variant="ghost"
                                className="h-6 w-6 p-0"
                                onClick={() => setOpen(false)}
                            >
                                <i className="icon-[mdi--close] size-3.5"></i>
                            </Button>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-1.5 space-y-1.5 text-xs">
                        {reversed.length === 0 ? (
                            <div className="text-center opacity-50 py-6">
                                (no tool calls yet)
                            </div>
                        ) : (
                            reversed.map((entry) => (
                                <Entry key={entry.id} entry={entry} />
                            ))
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
