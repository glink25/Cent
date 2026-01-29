import { useCallback, useMemo, useState } from "react";
import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import {
    DefaultCurrencies,
    DefaultCurrencyId,
} from "@/api/currency/currencies";
import type { CustomCurrency } from "@/ledger/type";
import { t, useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { type CConvert, useCurrencyStore } from "@/store/currency";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

export const useCurrency = () => {
    const [baseCurrencyId, customCurrencies = [], quickCurrencyIds = []] =
        useLedgerStore(
            useShallow((state) => [
                state.infos?.meta.baseCurrency ?? DefaultCurrencyId,
                state.infos?.meta.customCurrencies,
                state.infos?.meta.quickCurrencies,
            ]),
        );

    const t = useIntl();
    const allCurrencies = useMemo(
        () => [
            ...customCurrencies.map((c) => ({ ...c, label: c.name })),
            ...DefaultCurrencies.map((c) => ({ ...c, label: t(c.labelKey) })),
        ],
        [customCurrencies, t],
    );

    const baseCurrency = allCurrencies.find((c) => c.id === baseCurrencyId)!;

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
            // 自定义币种使用固定汇率
            const custom = customCurrencies.find((v) => v.id === target);
            if (custom) {
                const v = money / custom.rateToBase;
                return {
                    predict: v,
                    accurate: true,
                    finished: Promise.resolve(v),
                };
            }
            // 优先通过自定义汇率
            const uid = useUserStore.getState().id;
            const customRates =
                useLedgerStore.getState().infos?.meta.personal?.[uid]?.rates;
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
        [flag, customCurrencies],
    );

    const refresh = useCallback(async () => {
        return useCurrencyStore
            .getState()
            .refresh()
            .finally(() => {
                setFlag((v) => !v);
            });
    }, []);

    const updateCustomCurrency = useCallback(
        (currency: Omit<CustomCurrency, "id"> & { id?: string }) => {
            const id = currency.id ?? v4();
            return useLedgerStore.getState().updateGlobalMeta((meta) => {
                const customCurrencies = meta.customCurrencies ?? [];
                const index = customCurrencies.findIndex((c) => c.id === id);
                if (index === -1) {
                    customCurrencies.push({ ...currency, id });
                } else {
                    customCurrencies[index] = { ...currency, id };
                }
                return { ...meta, customCurrencies };
            });
        },
        [],
    );

    const deleteCustomCurrency = useCallback((id: string) => {
        return useLedgerStore.getState().updateGlobalMeta((meta) => {
            const customCurrencies = meta.customCurrencies ?? [];
            const index = customCurrencies.findIndex((c) => c.id === id);
            customCurrencies.splice(index, 1);
            return { ...meta, customCurrencies };
        });
    }, []);

    const quickCurrencies = useMemo(
        () =>
            quickCurrencyIds
                .map((id) => {
                    return allCurrencies.find((v) => v.id === id);
                })
                .filter((v) => v !== undefined),
        [quickCurrencyIds, allCurrencies],
    );
    const updateQuickCurrencies = useCallback((list: string[]) => {
        return useLedgerStore.getState().updateGlobalMeta((meta) => {
            return { ...meta, quickCurrencies: list };
        });
    }, []);

    return {
        baseCurrency,
        setBaseCurrency,
        convert,
        setRate,
        refresh,

        customCurrencies,
        updateCustomCurrency,
        deleteCustomCurrency,

        allCurrencies,
        quickCurrencies,
        updateQuickCurrencies,
    };
};

export const getAllCurrencies = () => {
    const customCurrencies =
        useLedgerStore.getState().infos?.meta.customCurrencies ?? [];
    return [
        ...customCurrencies.map((c) => ({ ...c, label: c.name })),
        ...DefaultCurrencies.map((c) => ({ ...c, label: t(c.labelKey) })),
    ];
};

export const getQuickCurrencies = () => {
    const allCurrencies = getAllCurrencies();
    const quickCurrencyIds =
        useLedgerStore.getState().infos?.meta.quickCurrencies ?? [];
    return quickCurrencyIds
        .map((id) => {
            return allCurrencies.find((v) => v.id === id);
        })
        .filter((v) => v !== undefined);
};
