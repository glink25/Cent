import { z } from "zod";
import { loadStorageAPI } from "@/api/storage/dynamic";
import { createTool, type Tool } from "@/assistant";
import compileWidget from "@/components/widget/core/compile";
import { validateComputed } from "@/components/widget/core/computed";
import runWidget from "@/components/widget/core/runner";
import type { GlobalMeta } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";
import { readAgentSnapshot } from "./web-host";

const exposure = { code: true, native: false };
export const widgetOperations = [
    createTool({
        name: "widgets",
        exposure,
        describe:
            "Read installed widgets, including source and storage. Optional id selects one widget.",
        argSchema: z.object({ id: z.string().optional() }),
        returnSchema: z.unknown(),
        handler: async ({ id }) => {
            const repo = useBookStore.getState().currentBookId;
            if (!repo) throw new Error("No active ledger");
            const { StorageAPI } = await loadStorageAPI();
            const meta = (await StorageAPI.getMeta(repo)) as GlobalMeta;
            if (useBookStore.getState().currentBookId !== repo)
                throw new Error("Ledger changed");
            const widgets = meta.widgets ?? [];
            if (!id) return widgets;
            const widget = widgets.find((w) => w.id === id);
            if (!widget) throw new Error("Widget not found");
            return widget;
        },
    }),
    createTool({
        name: "validateWidget",
        exposure,
        describe:
            "Execute a widget's render and computed functions in preview with real read data, without writes. Returns runtime diagnostics. Does not validate every possible interaction.",
        argSchema: z.object({
            code: z.string().min(1),
            storage: z.record(z.string(), z.json()).optional(),
        }),
        returnSchema: z.unknown(),
        handler: async ({ code, storage }, ctx) => {
            const snapshot = await readAgentSnapshot();
            ctx.signal?.throwIfAborted();
            const compiled = compileWidget(code);
            const widgetId = "agent-preview";
            const getData = async () => ({
                bills: snapshot.bills,
                categories: snapshot.meta.categories,
                tags: snapshot.meta.tags,
                baseCurrency: snapshot.meta.baseCurrency,
                customCurrencies: snapshot.meta.customCurrencies,
            });
            const runtime = {
                widgetId,
                viewer: { id: useUserStore.getState().id },
                storage,
            };
            const render = await runWidget(code, {
                grants: compiled.permissions,
                runtime,
                getData,
            });
            if (!render.success)
                return { valid: false, phase: "render", error: render.error };
            if (compiled.apiVersion.startsWith("2.")) {
                const computed = await runWidget(code, {
                    grants: compiled.permissions,
                    runtime: { ...runtime, mode: "computed" },
                    getData: async () => ({ ...(await getData()), bills: [] }),
                });
                if (!computed.success)
                    return {
                        valid: false,
                        phase: "computed",
                        error: computed.error,
                    };
                validateComputed(computed.result, widgetId);
            }
            return {
                valid: true,
                name: compiled.name,
                apiVersion: compiled.apiVersion,
                permissions: compiled.permissions,
                preview: render.result,
            };
        },
    }),
] as Tool[];
