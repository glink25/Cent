import { create } from "zustand";
import type { Tool } from "@/assistant";

export type ToolLogEntry = {
    id: number;
    name: string;
    startedAt: number;
    endedAt?: number;
    params: unknown;
    status: "running" | "success" | "error";
    result?: unknown;
    error?: string;
};

type DebugLogState = {
    entries: ToolLogEntry[];
    panelOpen: boolean;
    push: (entry: Omit<ToolLogEntry, "id">) => number;
    update: (id: number, patch: Partial<ToolLogEntry>) => void;
    clear: () => void;
    setPanelOpen: (v: boolean) => void;
};

let _id = 0;
const MAX_ENTRIES = 200;

export const useDebugLogStore = create<DebugLogState>((set) => ({
    entries: [],
    panelOpen: false,
    push: (entry) => {
        const id = ++_id;
        set((state) => {
            const next = [...state.entries, { ...entry, id }];
            if (next.length > MAX_ENTRIES)
                next.splice(0, next.length - MAX_ENTRIES);
            return { entries: next };
        });
        return id;
    },
    update: (id, patch) =>
        set((state) => ({
            entries: state.entries.map((e) =>
                e.id === id ? { ...e, ...patch } : e,
            ),
        })),
    clear: () => set({ entries: [] }),
    setPanelOpen: (v) => set({ panelOpen: v }),
}));

export function withDebugLog<A, R>(tool: Tool<A, R>): Tool<A, R> {
    return {
        ...tool,
        handler: async (arg, ctx) => {
            const store = useDebugLogStore.getState();
            const id = store.push({
                name: tool.name,
                startedAt: Date.now(),
                params: arg,
                status: "running",
            });
            try {
                const result = await tool.handler(arg, ctx);
                useDebugLogStore.getState().update(id, {
                    status: "success",
                    result,
                    endedAt: Date.now(),
                });
                return result;
            } catch (error) {
                useDebugLogStore.getState().update(id, {
                    status: "error",
                    error:
                        error instanceof Error ? error.message : String(error),
                    endedAt: Date.now(),
                });
                throw error;
            }
        },
    };
}
