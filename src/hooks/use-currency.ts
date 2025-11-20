import { useCallback } from "react";
import { useShallow } from "zustand/shallow";
import {
    DefaultCurrencies,
    DefaultCurrencyId,
} from "@/api/currency/currencies";
import { useBookStore } from "@/store/book";
import { useCurrencyStore } from "@/store/currency";
import { useLedgerStore } from "@/store/ledger";

export const useCurrency = () => {
    const baseCurrencyId = useLedgerStore(
        useShallow(
            (state) => state.infos?.meta.baseCurrency ?? DefaultCurrencyId,
        ),
    );

    const baseCurrency = DefaultCurrencies.find(
        (c) => c.id === baseCurrencyId,
    )!;

    const setBaseCurrency = useCallback(async (newCurrencyId: string) => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            prev.baseCurrency = newCurrencyId;
            return prev;
        });
    }, []);

    const { convert } = useCurrencyStore();

    return {
        baseCurrency,
        setBaseCurrency,
        convert,
    };
};
