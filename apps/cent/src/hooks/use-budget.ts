import { useCallback } from "react";
import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import type { Budget } from "@/components/budget/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";

export function useBudget() {
    const budgets = useLedgerStore(
        useShallow((state) => state.infos?.meta.budgets ?? []),
    );
    const add = useCallback(async (budget: Omit<Budget, "id">) => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        const id = v4();
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            if (prev.budgets === undefined) {
                prev.budgets = [];
            }
            prev.budgets.push({ ...budget, id });
            return prev;
        });
        return id;
    }, []);

    const update = useCallback(
        async (id: string, value?: Omit<Budget, "id">) => {
            const book = useBookStore.getState().currentBookId;
            if (!book) {
                return;
            }
            await useLedgerStore.getState().updateGlobalMeta((prev) => {
                if (prev.budgets === undefined) {
                    return prev;
                }
                if (value === undefined) {
                    prev.budgets = prev.budgets.filter((v) => v.id !== id);
                    return prev;
                }
                const index = prev.budgets.findIndex((v) => v.id === id);
                if (index === -1) {
                    return prev;
                }
                prev.budgets[index] = { id, ...value };
                return prev;
            });
        },
        [],
    );

    const reorder = useCallback(async (ordered: { id: string }[]) => {
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            prev.budgets = ordered
                .map((o) => prev.budgets?.find((b) => b.id === o.id))
                .filter((v) => v !== undefined);
            return prev;
        });
    }, []);
    return {
        budgets,
        add,
        update,
        reorder,
    };
}
