import { useCallback } from "react";
import { v4 } from "uuid";
import type { BillFilterView } from "@/ledger/extra-type";
import type { BillFilter } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";

export function useCustomFilters() {
    const addFilter = useCallback(
        async (name: string, form: Omit<BillFilterView, "id" | "name">) => {
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
                    ...form,
                    name,
                });
                return prev;
            });
            return id;
        },
        [],
    );

    const updateFilter = useCallback(
        async (id: string, value?: Omit<BillFilterView, "id">) => {
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
                prev.customFilters[index] = {
                    ...prev.customFilters[index],
                    ...value,
                    name: value.name ?? prev.customFilters[index],
                    filter: value.filter,
                };
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
