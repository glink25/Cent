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
import { cacheInDB } from "@/utils/cache";
import { GetOnlineAssetsCacheKey } from "@/utils/constant";
import { base64ToFile } from "@/utils/file";
import { creatorKey } from "./data";
import type { AgentSnapshot } from "./operations";

let scope = 0;
useBookStore.subscribe((state, previous) => {
    if (state.currentBookId !== previous.currentBookId) scope++;
});
useUserStore.subscribe((state, previous) => {
    if (state.id !== previous.id) scope++;
});

export const agentLedgerScope = () => scope;

export async function readAgentSnapshot(): Promise<AgentSnapshot> {
    const epoch = scope;
    const bookId = useBookStore.getState().currentBookId;
    const viewer = useUserStore.getState().id;
    if (!bookId) throw new Error("No active ledger");
    const { StorageAPI, StorageDeferredAPI } = await loadStorageAPI();
    const [items, raw] = await Promise.all([
        StorageDeferredAPI.readAllBills(bookId),
        StorageAPI.getMeta(bookId),
    ]);
    const bills = items.filter(
        (bill) =>
            typeof bill.id === "string" &&
            Number.isFinite(bill.time) &&
            Number.isSafeInteger(bill.amount) &&
            (bill.type === "income" || bill.type === "expense"),
    );
    const base = (raw ?? {}) as GlobalMeta;
    const meta = { ...base, categories: base.categories ?? BillCategories };
    const currentUser = useUserStore.getState();
    const viewerId = creatorKey(viewer);
    const collaborators = currentUser.cachedCollaborators[bookId] ?? [];
    const names =
        viewerId == null ? undefined : meta.personal?.[viewerId]?.names;
    const members = new Map<string, string | null>();
    for (const bill of bills) {
        const id = creatorKey(bill.creatorId);
        if (id !== null) members.set(id, names?.[id] ?? null);
    }
    for (const user of collaborators ?? []) {
        const id = String(user.id);
        members.set(id, names?.[id] ?? user.name);
    }
    if (viewerId !== null)
        members.set(viewerId, names?.[viewerId] ?? currentUser.name);
    let effective: Promise<GlobalMeta> | undefined;
    const computeMeta = async () => {
        let meta = { ...base, categories: base.categories ?? BillCategories };
        for (const widget of base.widgets ?? []) {
            if (!compileWidget(widget.code).apiVersion.startsWith("2."))
                continue;
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
                categories: insertComputed(
                    meta.categories,
                    computed.categories,
                ),
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
        return meta;
    };
    if (
        scope !== epoch ||
        useBookStore.getState().currentBookId !== bookId ||
        useUserStore.getState().id !== viewer
    )
        throw new Error("Ledger context changed");
    return {
        bookId,
        scope: epoch,
        skippedCount: items.length - bills.length,
        syncStatus: StorageAPI.type === "offline" ? "offline" : "unknown",
        bills,
        meta,
        effectiveMeta: () => {
            effective ??= computeMeta();
            return effective;
        },
        viewerId,
        members: [...members].map(([id, displayName]) => ({ id, displayName })),
        readAttachment: async (bill, index) => {
            const image = bill.images?.[index];
            if (!image) throw new Error("Attachment not found");
            if (typeof image !== "string") return image;
            if (image.startsWith("data:")) return base64ToFile(image);
            const load = StorageAPI.getOnlineAsset;
            const blob = load
                ? await cacheInDB(load, GetOnlineAssetsCacheKey)?.(
                      image,
                      bookId,
                  )
                : undefined;
            if (!blob) throw new Error("Attachment unavailable");
            return blob;
        },
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    };
}
