/**
 * 汇率数据结构 (与 kurrency 项目(https://github.com/glink25/kurrency)存储结构保持一致)
 */
export interface DailyRate {
    readonly date: string;
    readonly base: string;
    readonly rates: Record<string, number>;
}

/**
 * 最终返回的汇率对象结构
 */
export interface Rate {
    /** 汇率日期 (YYYY-MM-DD) */
    date: string;
    /** 当前基准货币 */
    base: string;
    /** 相对基准货币的汇率表 */
    rates: Record<string, number>;
    /** * 标识数据是否超出范围 (Fallback 模式)
     * 当请求日期无法获取，降级返回 latest 数据时为 true
     */
    outofrange?: boolean;
}

// 配置项：仓库分支与地址
const REPO_CONFIG = {
    baseUrl: "https://raw.githubusercontent.com/glink25/kurrency/main/data",
    defaultBase: "EUR",
} as const;

/**
 * 辅助函数：格式化日期为 YYYY-MM-DD 和 路径所需的 year/month
 * 使用 UTC 以避免时区导致的日期偏移
 */
const getDateParts = (inputDate: Date) => {
    const y = inputDate.getUTCFullYear();
    const m = inputDate.getUTCMonth() + 1;
    const d = inputDate.getUTCDate();

    const pad = (n: number) => n.toString().padStart(2, "0");

    return {
        year: y, // 保持为 number 以便进行比较
        yearStr: y.toString(),
        monthStr: pad(m),
        fullDate: `${y}-${pad(m)}-${pad(d)}`, // YYYY-MM-DD
    };
};

/**
 * 核心逻辑：基于指定货币重新计算汇率 (Rebasing)
 * 公式: TargetCurrencyRate = OriginalRate[TargetCurrency] / OriginalRate[NewBase]
 */
const rebaseRates = (dailyData: DailyRate, newBase: string): Rate => {
    // 如果请求的就是原始基准 (EUR)，直接返回
    if (newBase === dailyData.base) {
        return { ...dailyData }; // 返回浅拷贝以匹配 Rate 接口
    }

    // 获取新基准货币相对于 EUR 的汇率 (例如 EUR -> USD)
    const baseRate = dailyData.rates[newBase];

    if (!baseRate) {
        throw new Error(
            `Currency code '${newBase}' not found in exchange rates.`,
        );
    }

    // 重新计算所有汇率
    const newRates = Object.entries(dailyData.rates).reduce(
        (acc, [currency, rate]) => {
            acc[currency] = rate / baseRate;
            return acc;
        },
        {} as Record<string, number>,
    );

    // 添加 EUR (因为原始数据中不含 EUR -> EUR)
    newRates[dailyData.base] = 1 / baseRate;

    return {
        date: dailyData.date,
        base: newBase,
        rates: newRates,
    };
};

/**
 * 内部函数：获取最新数据作为降级方案
 */
const fetchLatestFallback = async (base: string): Promise<Rate> => {
    const url = `${REPO_CONFIG.baseUrl}/latest.json`;
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(
            `Failed to fetch latest data fallback: ${response.statusText}`,
        );
    }

    // latest.json 通常是一个单独的 DailyRate 对象
    const latestData: DailyRate = await response.json();

    // 计算汇率
    const rebased = rebaseRates(latestData, base);

    // 添加 outofrange 标记
    return {
        ...rebased,
        outofrange: true,
    };
};

/**
 * 获取汇率信息
 * @param base 基础货币代码 (e.g., "USD", "CNY")
 * @param date 指定日期，不指定则使用当前日期
 * @returns 汇率数据 Promise
 */
export const fetchCurrency = async (
    base: string = "EUR",
    date?: Date | number,
): Promise<Rate> => {
    if (date === undefined) {
        const res = await fetchLatestFallback(base);
        return {
            ...res,
            outofrange: false,
        };
    }
    const targetDateObj = typeof date === "number" ? new Date(date) : date;
    const { year, yearStr, monthStr, fullDate } = getDateParts(targetDateObj);

    // 1. 严格校验：如果日期早于 1999 年，抛出错误
    if (year < 1999) {
        throw new Error("Exchange rate data is not available prior to 1999.");
    }

    // 2. 构建特定日期的 GitHub Raw URL
    const url = `${REPO_CONFIG.baseUrl}/${yearStr}/${monthStr}/data.json`;

    try {
        // 3. 尝试请求指定日期的数据
        const response = await fetch(url);

        // 如果请求失败 (404 等)，手动抛出错误以进入 catch 块进行降级处理
        if (!response.ok) {
            throw new Error(`Data missing for ${yearStr}/${monthStr}`);
        }

        const dataList: DailyRate[] = await response.json();

        // 4. 查找最近的交易日 (date <= targetDate)
        // 注意：如果当月数据中所有日期都比 fullDate 大（理论上不应发生，除非文件放错），
        // 或者找不到匹配项，我们应该降级或者取当月最早/最晚。
        const matchedRecord =
            dataList.find((item) => item.date <= fullDate) ??
            dataList[dataList.length - 1];

        if (!matchedRecord) {
            throw new Error(
                `No matching date found inside ${yearStr}/${monthStr}`,
            );
        }

        // 5. 成功获取指定日期，正常返回
        return rebaseRates(matchedRecord, base);
    } catch (error) {
        // 6. 捕获任何获取指定日期时的错误（404, 网络问题, 解析错误, 找不到对应日期记录）
        // console.warn("Specific date fetch failed, falling back to latest:", error);

        try {
            // 执行降级逻辑：获取 latest.json
            return await fetchLatestFallback(base);
        } catch (fallbackError) {
            // 如果 latest 也获取失败，则彻底抛出错误
            return Promise.reject(fallbackError);
        }
    }
};
