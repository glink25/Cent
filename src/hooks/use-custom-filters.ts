import { useCallback } from "react";
import { v4 } from "uuid";
import type { BillFilter } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";

export function useCustomFilters() {
    const addFilter = useCallback(async (name: string, form: BillFilter) => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        const id = v4();
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            if (prev.customFilters === undefined) {
                prev.customFilters = [];
            }
            prev.customFilters.push({
                id,
                filter: form,
                name,
            });
            return prev;
        });
        return id;
    }, []);

    const updateFilter = useCallback(
        async (id: string, value?: { name?: string; filter?: BillFilter }) => {
            const book = useBookStore.getState().currentBookId;
            if (!book) {
                return;
            }
            await useLedgerStore.getState().updateGlobalMeta((prev) => {
                if (prev.customFilters === undefined) {
                    return prev;
                }
                if (value === undefined) {
                    prev.customFilters = prev.customFilters.filter(
                        (v) => v.id !== id,
                    );
                    return prev;
                }
                const index = prev.customFilters.findIndex((v) => v.id === id);
                if (index === -1) {
                    return prev;
                }
                if (value.name) {
                    prev.customFilters[index].name = value.name;
                }
                if (value.filter) {
                    prev.customFilters[index].filter = value.filter;
                }
                return prev;
            });
        },
        [],
    );

    return {
        addFilter,
        updateFilter,
    };
}
