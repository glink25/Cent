import dayjs from "dayjs";

interface Response {
    success: boolean;
    base: string;
    date: string;
    availableCurrencies: number;
    rates: Rates;
}

export type Rates = Record<string, number>;

const LOGIN_API_HOST = import.meta.env.VITE_LOGIN_API_HOST;

// 缓存同时进行的请求，避免重复请求
const requestCache = new Map<string, Promise<Rates>>();

/**
 * 获取汇率信息，具有请求去重功能
 * 当接收到相同的 base 和 date 参数时，只真正请求一次，其余的返回同一个 Promise
 * @param base 基础货币代码
 * @param date 指定日期，不指定则使用当前日期
 * @returns 汇率数据 Promise
 */
export const fetchCurrency = async (base: string, date?: Date | number) => {
    const day = date
        ? typeof date === "number"
            ? dayjs.unix(date / 1000)
            : dayjs(date)
        : dayjs();
    const dateStr = day.format("YYYY-MM-DD");
    const cacheKey = `${base}-${dateStr}`;

    // 如果已有相同的请求正在进行，直接返回现有的 Promise
    const existingPromise = requestCache.get(cacheKey);
    if (existingPromise) {
        return existingPromise;
    }

    // 创建新的请求 Promise
    const promise = (async () => {
        const isToday = day.isSameOrAfter(dayjs());
        console.log(isToday, "td", dateStr);
        const dateParam = (() => {
            if (!date) {
                return "";
            }
            // 如果日期是今天或者将来，则不传日期以获取到最新的汇率
            if (isToday) {
                return "";
            }
            return `/${dateStr}`;
        })();
        const res = await fetch(
            `${LOGIN_API_HOST}/api/currency/${base}${dateParam}`,
        );

        if (!res.ok) {
            throw new Error(
                `Failed to fetch currency rates: ${res.status} ${res.statusText}`,
            );
        }

        const json: Response = await res.json();
        return json.rates;
    })();

    // 将 Promise 存入缓存
    requestCache.set(cacheKey, promise);

    // 请求完成后清理缓存，以便下次需要时发起新请求
    promise.finally(() => {
        requestCache.delete(cacheKey);
    });

    return promise;
};

// const response = {
//     success: true,
//     base: "CNY",
//     date: "2025-11-19",
//     availableCurrencies: 31,
//     rates: {
//         USD: 0.140638272054362,
//         JPY: 21.8347287950491,
//         BGN: 0.237325567285524,
//         CZK: 2.93508069409052,
//         DKK: 0.906249241596894,
//         GBP: 0.107037980827569,
//         HUF: 46.712777575537,
//         PLN: 0.514986045382842,
//         RON: 0.617279456376653,
//         SEK: 1.33442543380658,
//         CHF: 0.112037374105084,
//         ISK: 17.8619099623832,
//         NOK: 1.4237713869676,
//         TRY: 5.95408324232496,
//         AUD: 0.216357238199248,
//         BRL: 0.751037495449581,
//         CAD: 0.197269748816891,
//         CNY: 1,
//         HKD: 1.09492780002427,
//         IDR: 2356.54896250455,
//         ILS: 0.460077660478097,
//         INR: 12.4552845528455,
//         KRW: 205.752942604053,
//         MXN: 2.59387210290013,
//         MYR: 0.585620677102294,
//         NZD: 0.248258706467662,
//         PHP: 8.27351049629899,
//         SGD: 0.183145249362941,
//         THB: 4.55879140880961,
//         ZAR: 2.42386846256522,
//         EUR: 0.12134449702706,
//     },
// };
