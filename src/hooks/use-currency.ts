import { useCallback, useState } from "react";
import { useShallow } from "zustand/shallow";
import {
    DefaultCurrencies,
    DefaultCurrencyId,
} from "@/api/currency/currencies";
import { useBookStore } from "@/store/book";
import { type CConvert, useCurrencyStore } from "@/store/currency";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

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
            // 切换本位币时，会将自定义汇率进行清空
            const uid = useUserStore.getState().id;
            if (prev.personal?.[uid]) {
                prev.personal[uid].rates = undefined;
            }
            return prev;
        });
    }, []);

    // 用于手动触发React更新
    const [flag, setFlag] = useState(false);
    const setRate = useCallback(
        async (target: string, rate: number | undefined) => {
            if (rate && rate <= 0) {
                throw new Error("rate must larger than 0");
            }
            await useLedgerStore.getState().updatePersonalMeta((prev) => {
                // TODO: 使用更简洁的函数代替
                const entries = [
                    ...Object.entries(prev.rates ?? {}).filter(
                        ([k]) => k !== target,
                    ),
                    [target, rate],
                ].filter(([, v]) => v !== undefined);
                prev.rates =
                    entries.length === 0
                        ? undefined
                        : Object.fromEntries(entries);
                return prev;
            });
            setFlag((v) => !v);
        },
        [],
    );

    const convert: CConvert = useCallback(
        (money, target, base, date) => {
            // 优先通过自定义汇率
            const uid = useUserStore.getState().id;
            const customRates =
                useLedgerStore.getState().infos?.meta.personal?.[uid].rates;
            const customRate = (() => {
                if (customRates?.[target]) {
                    return customRates[target];
                }
                if (customRates?.[base]) {
                    return 1 / customRates?.[base];
                }
            })();
            if (customRate) {
                const value = money / customRate;
                return {
                    predict: value,
                    accurate: true,
                    finished: Promise.resolve(value),
                };
            }
            if (flag) {
                //nothing
            }
            const rawConvert = useCurrencyStore.getState().convert;
            return rawConvert(money, target, base, date);
        },
        [flag],
    );

    const refresh = useCallback(async () => {
        return useCurrencyStore
            .getState()
            .refresh()
            .finally(() => {
                setFlag((v) => !v);
            });
    }, []);

    return {
        baseCurrency,
        setBaseCurrency,
        convert,
        setRate,
        refresh,
    };
};
