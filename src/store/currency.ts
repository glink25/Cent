// 实现一个缓存优先的汇率换算store，它能将汇率信息保存到本地,避免频繁请求
import dayjs from "dayjs";
import { create, type StateCreator } from "zustand";
import {
    createJSONStorage,
    type PersistOptions,
    persist,
} from "zustand/middleware";
import { fetchCurrency, type Rates } from "@/api/currency";
import { DefaultCurrencyId } from "@/api/currency/currencies";
import Outdated from "@/api/currency/data.json";

export type CConvert = (
    money: number,
    target: string,
    base: string,
    date?: Date | number,
) => {
    predict: number;
    accurate: boolean;
    finished: Promise<number>;
};

type Store = {
    data: { rates: Rates; base: string; date: string }[];
    // 将今日的汇率信息保存到本地
    refresh: () => Promise<void>;
    // 将目标货币转换为本位币，例如convert(100,'USD','CNY') => { predict: 700, accurate: Promise(732)}
    // predict表示缓存优先的计算结果，accurate则是调用api后获取的结果
    convert: CConvert;
};

type Persist<S> = (
    config: StateCreator<S>,
    options: PersistOptions<S>,
) => StateCreator<S>;

export const useCurrencyStore = create<Store>()(
    (persist as Persist<Store>)(
        (set, get) => {
            const refresh = async () => {
                const today = new Date();
                const dateStr = dayjs(today).format("YYYY-MM-DD");
                const state = get();

                // 检查缓存中是否已有相同日期的汇率信息
                const hasCache = state.data.some(
                    (item) => item.date === dateStr,
                );

                // 如果缓存中已有相同日期的数据，则无需重新请求
                if (hasCache) {
                    return;
                }

                const rates = await fetchCurrency(DefaultCurrencyId, today);
                set((state) => ({
                    data: [
                        {
                            rates,
                            base: DefaultCurrencyId,
                            date: dateStr,
                        },
                        ...state.data,
                    ],
                }));
            };

            Promise.resolve().then(() => {
                refresh();
            });

            const convert: CConvert = (money, target, base, date) => {
                const state = get();
                const dateStr = dayjs(date).format("YYYY-MM-DD");

                let predictRate = 1;
                let accurate = false;
                let cachedData = state.data.find(
                    (item) => item.date === dateStr && item.base === base,
                );

                // 汇率换算逻辑：money是target币，要换算成base币
                // 例如：convert(100, 'USD', 'CNY')，即100美元换算成人民币
                // 需要用 base/target 的汇率
                if (target === base) {
                    predictRate = 1;
                    accurate = true;
                } else if (cachedData?.rates[target]) {
                    // rates[target]表示1 base = x target
                    // 所以 target/base = 1 / rates[target]
                    predictRate = 1 / cachedData.rates[target];
                    accurate = true;
                } else {
                    // 如果日期相同但base不同，查找同日期的任何缓存数据，通过汇率转换计算
                    const sameDateCache = state.data.find(
                        (item) => item.date === dateStr,
                    );
                    if (
                        sameDateCache?.rates[target] &&
                        sameDateCache?.rates[base]
                    ) {
                        // 使用同日期缓存通过汇率转换：
                        // target/base = (target/sameDateCache.base) / (base/sameDateCache.base)
                        // 即: target/base = (1/sameDateCache.rates[target]) / (1/sameDateCache.rates[base])
                        predictRate =
                            sameDateCache.rates[base] /
                            sameDateCache.rates[target];
                        accurate = true; // 日期相同且两个币都在缓存中，准确度应为true
                        cachedData = sameDateCache;
                    } else {
                        // 查找任何日期最接近的缓存数据用于预测
                        const anyDateCache = state.data.find(
                            (item) => item.base === base,
                        );
                        if (anyDateCache?.rates[target]) {
                            predictRate = 1 / anyDateCache.rates[target];
                            accurate = false;
                        } else if (state.data.length > 0) {
                            // 如果缓存中没有相同base的数据，用第一条数据通过汇率转换
                            const firstCache = state.data[0];
                            if (
                                firstCache.rates[target] &&
                                firstCache.rates[base]
                            ) {
                                // 先将target币换算成firstCache.base币，再换算成base币
                                // target/base = (target/firstCache.base) / (base/firstCache.base)
                                predictRate =
                                    firstCache.rates[base] /
                                    firstCache.rates[target];
                                accurate = false;
                            }
                        }
                    }
                }

                const predict = money * predictRate;

                // 异步获取准确汇率
                const finished = (async () => {
                    if (target === base) {
                        return money;
                    }
                    // 如果缓存中已有相同日期和base的汇率数据，则无需重新请求
                    if (cachedData?.rates[target]) {
                        // 检查是否已经从同日期缓存转换过
                        if (cachedData.base === base) {
                            return money * (1 / cachedData.rates[target]);
                        } else {
                            // 日期相同但base不同，使用汇率转换
                            return (
                                money *
                                (cachedData.rates[base] /
                                    cachedData.rates[target])
                            );
                        }
                    }

                    // 由于 fetchCurrency 已经内部处理了请求去重，
                    // 相同的 base 和 date 参数只会真正请求一次
                    const freshRates = await fetchCurrency(base, date);
                    let accurateRate = predictRate;
                    if (freshRates[target]) {
                        accurateRate = 1 / freshRates[target];
                    }
                    return money * accurateRate;
                })();

                return {
                    predict,
                    accurate,
                    finished,
                };
            };

            return {
                data: [
                    {
                        rates: Outdated.rates,
                        base: Outdated.base,
                        date: Outdated.date,
                    },
                ],
                refresh,
                convert,
            };
        },
        {
            name: "currency-store",
            storage: createJSONStorage(() => localStorage),
            version: 0,
            partialize(state) {
                return {
                    data: state.data,
                } as Store;
            },
        },
    ),
);
