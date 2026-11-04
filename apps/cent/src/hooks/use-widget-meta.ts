import { useEffect, useMemo } from "react";
import { create } from "zustand";
import compileWidget from "@/components/widget/core/compile";
import {
    type ComputedMeta,
    type EffectiveEntry,
    emptyComputed,
    insertComputed,
    validateComputed,
} from "@/components/widget/core/computed";
import runWidget from "@/components/widget/core/runner";
import { BillCategories } from "@/ledger/category";
import type { CustomCurrency, GlobalMeta } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

const emptyMeta: GlobalMeta = { tags: [] };
const useComputed = create<{
    source?: GlobalMeta;
    viewer?: string | number;
    repo?: string;
    value: ComputedMeta;
    errors: Record<string, string>;
}>(() => ({ value: emptyComputed, errors: {} }));
let started = false;
let revision = 0;
let timer: ReturnType<typeof setTimeout>;
function schedule() {
    const version = ++revision;
    clearTimeout(timer);
    timer = setTimeout(async () => {
        const source = useLedgerStore.getState().infos?.meta;
        const viewer = useUserStore.getState().id;
        const repo = useBookStore.getState().currentBookId;
        const value: ComputedMeta = {
            customCurrencies: [],
            categories: [],
            tags: [],
            tagGroups: [],
            customFilters: [],
        };
        const errors: Record<string, string> = {};
        // Computed reads base metadata and storage only, never another widget's output or bills.
        await Promise.all(
            (source?.widgets ?? [])
                .filter((w) =>
                    compileWidget(w.code).apiVersion.startsWith("2."),
                )
                .map(async (widget) => {
                    try {
                        const result = await runWidget(widget.code, {
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
                                categories:
                                    source?.categories ?? BillCategories,
                                tags: source?.tags,
                                baseCurrency: source?.baseCurrency,
                                customCurrencies: source?.customCurrencies,
                                quickCurrencies: source?.quickCurrencies,
                            }),
                        });
                        if (!result.success) throw new Error(result.error);
                        const computed = validateComputed(
                            result.result,
                            widget.id,
                        );
                        // Gather in installation order below; completion order must not affect positions.
                        return { id: widget.id, computed };
                    } catch (e) {
                        errors[widget.id] = String(e);
                        return undefined;
                    }
                }),
        ).then((results) => {
            for (const result of results)
                if (result) {
                    value.customCurrencies.push(
                        ...result.computed.customCurrencies,
                    );
                    value.categories.push(...result.computed.categories);
                    value.tags.push(...result.computed.tags);
                    value.tagGroups.push(...result.computed.tagGroups);
                    value.customFilters.push(...result.computed.customFilters);
                }
        });
        if (version === revision)
            useComputed.setState({ source, viewer, repo, value, errors });
    }, 50);
}
function start() {
    if (started) return;
    started = true;
    useLedgerStore.subscribe((s, prev) => {
        if (s.infos?.meta !== prev.infos?.meta) schedule();
    });
    useUserStore.subscribe((s, prev) => {
        if (s.id !== prev.id) schedule();
    });
    useBookStore.subscribe((s, prev) => {
        if (s.currentBookId !== prev.currentBookId) schedule();
    });
    schedule();
}
export function useWidgetMeta() {
    const base = useLedgerStore((s) => s.infos?.meta ?? emptyMeta);
    const viewer = useUserStore((s) => s.id);
    const repo = useBookStore((s) => s.currentBookId);
    const derived = useComputed();
    useEffect(start, []);
    return useMemo(() => {
        const value =
            derived.source === base &&
            derived.viewer === viewer &&
            derived.repo === repo
                ? derived.value
                : emptyComputed;
        return {
            customCurrencies: insertComputed(
                base.customCurrencies ?? [],
                value.customCurrencies,
            ),
            categories: insertComputed(
                base.categories ?? BillCategories,
                value.categories,
            ),
            tags: insertComputed(base.tags ?? [], value.tags),
            tagGroups: insertComputed(
                base.personal?.[viewer]?.tagGroups ?? [],
                value.tagGroups,
            ),
            customFilters: insertComputed(
                base.customFilters ?? [],
                value.customFilters,
            ),
            errors: derived.errors,
        };
    }, [base, viewer, repo, derived]);
}

// Imperative readers use the same source/viewer/repository check as the hook.
export function getEffectiveCustomCurrencies(): EffectiveEntry<CustomCurrency>[] {
    const base = useLedgerStore.getState().infos?.meta;
    const derived = useComputed.getState();
    const value =
        derived.source === base &&
        derived.viewer === useUserStore.getState().id &&
        derived.repo === useBookStore.getState().currentBookId
            ? derived.value
            : emptyComputed;
    return insertComputed(base?.customCurrencies ?? [], value.customCurrencies);
}
