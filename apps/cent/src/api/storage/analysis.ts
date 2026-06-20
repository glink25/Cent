import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";

dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

/* ---------------- types ---------------- */

export type BillLike = {
    amount: number;
    time: number; // ms
    type: "expense" | "income";
    comment?: string;
};

export type AnalysisType = "income" | "expense" | "balance";
export type AnalysisUnit = "year" | "month" | "week" | "day";

export type Detail = {
    /** 期间总支出或收入（如果 type 为 balance，则为 income - expense） */
    total: number;
    /** 时间跨度（天），可为小数（hours/24） */
    days: number;
    /** 日均 */
    dayAvg: number;
    /** 周均 */
    weekAvg: number;
    /** 月均 */
    monthAvg: number;
    /** 年均 */
    yearAvg: number;
};

export type AnalysisResult = {
    current: Detail; // 真实统计值（截止 reference / 期末）
    projected: Detail; // 投影后的统计值（若当前期未结束则投影到完整期）
    previous: Detail; // 上一周期的完整统计（不投影）
    lastYear: Detail; // 去年同期的完整统计（不投影）
    bills: BillLike[];
};

/* ---------------- constants & helpers ---------------- */

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AVG_DAYS_PER_WEEK = 7;
const AVG_DAYS_PER_MONTH = 30.436875; // average
const AVG_DAYS_PER_YEAR = 365.2425;

function safeDiv(a: number, b: number) {
    return b === 0 ? 0 : a / b;
}

/** 根据 AnalysisType 对 bills 求和（只对传入 bills 生效） */
function sumByType(bills: BillLike[], type: AnalysisType): number {
    if (type === "income") {
        return bills
            .filter((b) => b.type === "income")
            .reduce((s, b) => s + b.amount, 0);
    } else if (type === "expense") {
        return bills
            .filter((b) => b.type === "expense")
            .reduce((s, b) => s + b.amount, 0);
    } else {
        const income = bills
            .filter((b) => b.type === "income")
            .reduce((s, b) => s + b.amount, 0);
        const expense = bills
            .filter((b) => b.type === "expense")
            .reduce((s, b) => s + b.amount, 0);
        return income - expense;
    }
}

/** 构建 Detail（days 可以为小数） */
function buildDetail(total: number, days: number): Detail {
    const safeDays = days > 0 ? days : 1 / 24 / 3600 / 1000; // extremely small to avoid /0
    return {
        total,
        days,
        dayAvg: total / safeDays,
        weekAvg: total / (safeDays / AVG_DAYS_PER_WEEK),
        monthAvg: total / (safeDays / AVG_DAYS_PER_MONTH),
        yearAvg: total / (safeDays / AVG_DAYS_PER_YEAR),
    };
}

/* ---------------- main function ---------------- */

/**
 * @param dateRange [startMs, endMs] —— 这里 dateRange[0] 将被当作 reference （用于“当前”计算基准）
 * @param type "income" | "expense" | "balance"
 * @param analysisUnit 可选，若提供则以该粒度计算 current/previous/lastYear
 * @param fetchBills 必须提供，函数签名: (range: [startMs, endMs]) => Promise<BillLike[]>
 */
export const analysis = async (
    dateRange: [number, number],
    type: AnalysisType,
    analysisUnit: AnalysisUnit | undefined,
    fetchBills: (range: [number, number]) => Promise<BillLike[]>,
): Promise<AnalysisResult> => {
    if (!fetchBills) throw new Error("fetchBills 必须提供");
    const [rangeStartMs, rangeEndMs] = dateRange;
    if (rangeStartMs >= rangeEndMs)
        throw new Error("dateRange start must be < end");

    // reference time = dateRange[0] per your requirement (用于计算 current 的已过时间)
    const referenceMs = rangeStartMs;
    const refDayjs = dayjs(referenceMs);

    // helper: fetch and build Detail for arbitrary [s,e) range,
    // currentDays uses elapsed = min(referenceMs, e) - s
    // for projected: if referenceMs < e => project currentTotal linearly to full period
    const detailForRange = async (startMs: number, endMs: number) => {
        // fetch bills in [startMs, endMs)
        const bills = await fetchBills([startMs, endMs]);

        const fullPeriodMs = Math.max(0, endMs - startMs);
        const fullDays = fullPeriodMs / MS_PER_DAY;

        // current: use bills up to min(referenceMs, endMs)
        const effectiveEndMs = endMs; //Math.min(referenceMs, endMs);
        const elapsedMs = Math.max(0, effectiveEndMs - startMs);
        const currentDays = elapsedMs / MS_PER_DAY;

        // bills that occurred before or at effectiveEndMs (note fetchBills returned entire [start,end) so we must filter)
        const billsUpToEffective = bills.filter((b) => b.time < effectiveEndMs);

        const currentTotal = sumByType(billsUpToEffective, type);

        // projected: if referenceMs < endMs (i.e. period not finished relative to reference),
        // then project currentTotal from elapsedMs -> fullPeriodMs linearly.
        let projectedTotal: number;
        if (elapsedMs <= 0) {
            projectedTotal = 0;
        } else if (elapsedMs >= fullPeriodMs) {
            // already finished
            projectedTotal = currentTotal;
        } else {
            projectedTotal = (currentTotal / elapsedMs) * fullPeriodMs;
        }

        const currentDetail = buildDetail(
            currentTotal,
            currentDays > 0 ? currentDays : fullDays,
        );
        const projectedDetail = buildDetail(projectedTotal, fullDays);

        return { currentDetail, projectedDetail, bills };
    };

    // CASE A: analysisUnit not provided -> use dateRange as the period
    if (!analysisUnit) {
        // compute current/projected based on dateRange and referenceMs
        const { currentDetail, projectedDetail, bills } = await detailForRange(
            rangeStartMs,
            rangeEndMs,
        );

        // previous: immediately previous same-length period before rangeStart
        const prevStartMs = rangeStartMs - (rangeEndMs - rangeStartMs);
        const prevEndMs = rangeStartMs;
        // lastYear: shift by -1 year
        const lastYearStartMs = dayjs(rangeStartMs)
            .subtract(1, "year")
            .valueOf();
        const lastYearEndMs = dayjs(rangeEndMs).subtract(1, "year").valueOf();

        // compute previous and lastYear (they are full periods -> no projection needed)
        const prevBills = await fetchBills([prevStartMs, prevEndMs]);
        const prevTotal = sumByType(prevBills, type);
        const prevDays = (prevEndMs - prevStartMs) / MS_PER_DAY;
        const previousDetail = buildDetail(prevTotal, prevDays);

        const lastYearBills = await fetchBills([
            lastYearStartMs,
            lastYearEndMs,
        ]);
        const lastYearTotal = sumByType(lastYearBills, type);
        const lastYearDays = (lastYearEndMs - lastYearStartMs) / MS_PER_DAY;
        const lastYearDetail = buildDetail(lastYearTotal, lastYearDays);

        return {
            current: currentDetail,
            projected: projectedDetail,
            previous: previousDetail,
            lastYear: lastYearDetail,
            bills,
        };
    }

    // CASE B: analysisUnit provided -> compute based on the period that contains referenceMs
    // current period bounds (startOf(unit) .. startOf(unit)+1unit)
    const startOfUnit = refDayjs.startOf(analysisUnit);
    const currStartMs = startOfUnit.valueOf();
    const currEndMs = startOfUnit.add(1, analysisUnit).valueOf();

    // previous period immediately before current
    const prevStartMs = dayjs(currStartMs).subtract(1, analysisUnit).valueOf();
    const prevEndMs = currStartMs;

    // lastYear same period
    const lastYearStartMs = dayjs(currStartMs).subtract(1, "year").valueOf();
    const lastYearEndMs = dayjs(currEndMs).subtract(1, "year").valueOf();

    // compute current + projected
    const {
        currentDetail: currCurrent,
        projectedDetail: currProjected,
        bills,
    } = await detailForRange(currStartMs, currEndMs);

    // previous: full period stats (previous is in past, so days = full)
    const prevBills = await fetchBills([prevStartMs, prevEndMs]);
    const prevTotal = sumByType(prevBills, type);
    const prevDays = (prevEndMs - prevStartMs) / MS_PER_DAY;
    const previousDetail = buildDetail(prevTotal, prevDays);

    // lastYear: full period stats
    const lastYearBills = await fetchBills([lastYearStartMs, lastYearEndMs]);
    const lastYearTotal = sumByType(lastYearBills, type);
    const lastYearDays = (lastYearEndMs - lastYearStartMs) / MS_PER_DAY;
    const lastYearDetail = buildDetail(lastYearTotal, lastYearDays);

    return {
        current: currCurrent,
        projected: currProjected,
        previous: previousDetail,
        lastYear: lastYearDetail,
        bills,
    };
};
