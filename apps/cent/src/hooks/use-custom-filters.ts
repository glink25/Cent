import { useCallback } from "react";
import { v4 } from "uuid";
import type { BillFilterView } from "@/ledger/extra-type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";

export const DefaultFilterViewId = "default-filter-view";

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
                // delete
                if (value === undefined) {
                    prev.customFilters = prev.customFilters?.filter(
                        (v) => v.id !== id,
                    );
                    return prev;
                }
                // change & add
                if (prev.customFilters === undefined) {
                    prev.customFilters = [];
                }

                const index = prev.customFilters.findIndex((v) => v.id === id);
                const newFilter = {
                    ...prev.customFilters[index],
                    ...value,
                    id,
                    name: value.name ?? prev.customFilters[index],
                    filter: value.filter,
                };
                if (index === -1) {
                    if (id === DefaultFilterViewId) {
                        prev.customFilters.unshift(newFilter);
                    } else {
                        prev.customFilters.push(newFilter);
                    }
                } else {
                    prev.customFilters[index] = newFilter;
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
