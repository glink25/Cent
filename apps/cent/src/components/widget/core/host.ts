import { v4 } from "uuid";
import { loadStorageAPI } from "@/api/storage/dynamic";
import type { Action } from "@/database/stash";
import { getEffectiveCustomCurrencies } from "@/hooks/use-widget-meta";
import { BillCategories } from "@/ledger/category";
import type { Bill, GlobalMeta } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import type { Widget } from "../type";
import { resolveAttachments } from "./attachments";
import compileWidget from "./compile";
import { jsonObject, validateEdit } from "./validation";

export async function widgetData(bills?: Bill[]) {
    const repo = useBookStore.getState().currentBookId;
    const { StorageAPI, StorageDeferredAPI } = await loadStorageAPI();
    if (!repo) throw new Error("No active ledger");
    const meta = (await StorageAPI.getMeta(repo)) as GlobalMeta;
    return {
        bills: bills ?? (await StorageDeferredAPI.filter(repo, {})),
        widgets: meta.widgets,
        budgets: meta.budgets,
        creators: useLedgerStore.getState().infos?.creators,
        categories: meta.categories ?? BillCategories,
        tags: meta.tags,
        baseCurrency: meta.baseCurrency,
        customCurrencies: getEffectiveCustomCurrencies(),
        quickCurrencies: meta.quickCurrencies,
    };
}

export function widgetHost(
    widget: Widget,
    repo: string,
    isActive: () => boolean,
    resolveFile: (ref: string) => File | undefined = () => undefined,
) {
    return async (name: string, params: unknown) => {
        const { StorageAPI, StorageDeferredAPI } = await loadStorageAPI();
        if (!isActive() || useBookStore.getState().currentBookId !== repo)
            throw new Error("Widget session has ended");
        const meta = (await StorageAPI.getMeta(repo)) as GlobalMeta;
        const installed = meta.widgets?.find((w) => w.id === widget.id);
        if (!installed || installed.code !== widget.code)
            throw new Error("Widget has changed or was removed");
        const permission =
            name === "edit"
                ? "edit"
                : name === "setStorage"
                  ? "storage"
                  : undefined;
        if (
            !permission ||
            !installed.permissions.includes(permission) ||
            !compileWidget(installed.code).permissions.includes(permission)
        )
            throw new Error("Widget permission denied");
        if (name === "setStorage") {
            const storage = jsonObject.parse(params);
            if (JSON.stringify(storage).length > 1_000_000)
                throw new Error("Widget storage exceeds 1 MB");
            await StorageAPI.batch(repo, [
                {
                    type: "meta",
                    metaValue: {
                        ...meta,
                        widgets: meta.widgets?.map((w) =>
                            w.id === widget.id ? { ...w, storage } : w,
                        ),
                    },
                },
            ]);
            return storage;
        }
        const bills = await StorageDeferredAPI.filter(repo, {});
        const edit = validateEdit(params, widget.id, bills);
        const createdIds = edit.create.map(() => v4());
        const actions: Action<Bill>[] = [
            ...edit.create.map((value, index) => ({
                type: "update" as const,
                value: {
                    ...value,
                    images: resolveAttachments(value.images, resolveFile),
                    id: createdIds[index],
                    creatorId: useUserStore.getState().id,
                    extra: { ...value.extra, widgetId: widget.id },
                },
            })),
            ...edit.update.map(({ id, value }) => {
                const old = bills.find((b) => b.id === id)!;
                return {
                    type: "update" as const,
                    value: {
                        ...value,
                        images:
                            resolveAttachments(value.images, resolveFile) ??
                            old.images,
                        id,
                        creatorId: old.creatorId,
                        extra: {
                            ...old.extra,
                            ...value.extra,
                            widgetId: widget.id,
                        },
                    },
                };
            }),
            ...edit.delete.map((id) => ({
                type: "delete" as const,
                value: id,
            })),
        ];
        if (!isActive() || useBookStore.getState().currentBookId !== repo)
            throw new Error("Widget session has ended");
        await StorageAPI.batch(repo, actions);
        return { createdIds };
    };
}
