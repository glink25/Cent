import { loadStorageAPI } from "@/api/storage/dynamic";
import compileWidget from "@/components/widget/core/compile";
import {
    insertComputed,
    validateComputed,
} from "@/components/widget/core/computed";
import runWidget from "@/components/widget/core/runner";
import { BillCategories } from "@/ledger/category";
import type { GlobalMeta } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";
import type { AgentSnapshot } from "./operations";

export async function readAgentSnapshot(): Promise<AgentSnapshot> {
    const bookId = useBookStore.getState().currentBookId;
    const viewer = useUserStore.getState().id;
    if (!bookId) throw new Error("No active ledger");
    const { StorageAPI, StorageDeferredAPI } = await loadStorageAPI();
    const [bills, raw] = await Promise.all([
        StorageDeferredAPI.filter(bookId, {}),
        StorageAPI.getMeta(bookId),
    ]);
    const base = raw as GlobalMeta;
    let meta = { ...base, categories: base.categories ?? BillCategories };
    for (const widget of base.widgets ?? []) {
        if (!compileWidget(widget.code).apiVersion.startsWith("2.")) continue;
        const output = await runWidget(widget.code, {
            grants: widget.permissions,
            settings: widget.settings,
            runtime: {
                widgetId: widget.id,
                viewer: { id: viewer },
                storage: widget.storage,
                mode: "computed",
            },
            getData: async () => ({
                bills: [],
                categories: base.categories ?? BillCategories,
                tags: base.tags,
                baseCurrency: base.baseCurrency,
                customCurrencies: base.customCurrencies,
                quickCurrencies: base.quickCurrencies,
            }),
        });
        if (!output.success)
            throw new Error(
                `Computed metadata failed for ${widget.id}: ${output.error}`,
            );
        const computed = validateComputed(output.result, widget.id);
        meta = {
            ...meta,
            categories: insertComputed(meta.categories, computed.categories),
            tags: insertComputed(meta.tags ?? [], computed.tags),
            customCurrencies: insertComputed(
                meta.customCurrencies ?? [],
                computed.customCurrencies,
            ),
            customFilters: insertComputed(
                meta.customFilters ?? [],
                computed.customFilters,
            ),
        };
    }
    if (
        useBookStore.getState().currentBookId !== bookId ||
        useUserStore.getState().id !== viewer
    )
        throw new Error("Ledger context changed");
    return {
        bookId,
        bills,
        meta,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}
