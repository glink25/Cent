import type { Bill } from "@/ledger/type";
import dayjs from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
dayjs.extend(isSameOrAfter);
dayjs.extend(isSameOrBefore);

type AnalysisUnit = "year" | "month" | "week" | "day";

interface CommonAnalysis {
	/** 期间总支出 */
	total: number;
	/** 时间跨度（天） */
	days: number;
	/** 日均支出 */
	dayAvg: number;
	/** 月均支出（按平均30.44天/月折算） */
	monthAvg: number;
	/** 年均支出（按平均365.24天/年折算） */
	yearAvg: number;
}

interface PredictAnalysis {
	/** 分析周期类型 */
	period: AnalysisUnit;
	/** 周期开始时间戳（ms） */
	periodStartMs: number;
	/** 周期结束时间戳（ms） */
	periodEndMs: number;
	/** 周期总长度（ms） */
	periodLengthMs: number;
	/** 已经过的时间（ms） */
	periodElapsedMs: number;
	/** 当前周期截止目前的支出 */
	periodTotalSoFar: number;
	/** 预测整个周期的总支出（基于当前支出线性推算） */
	periodProjectedTotal: number;
}

interface CompareItem {
	/** 对比周期开始时间戳（ms） */
	startMs: number;
	/** 对比周期结束时间戳（ms） */
	endMs: number;
	/** 对比周期支出总额 */
	total: number;
	/** 与当前预测支出相比的增长百分比（null表示无法计算） */
	changePct: number | null;
	/** 绝对变化值（当前预测支出 - 对比周期总额） */
	absoluteChange: number | null;
}

interface CurrentPeriod {
	/** 当前周期开始时间戳（ms） */
	startMs: number;
	/** 当前周期结束时间戳（ms） */
	endMs: number;
	/** 当前周期到目前为止的支出 */
	totalSoFar: number;
	/** 当前周期预测支出 */
	projectedTotal: number;
	/** 当前周期完整记录总额（如果周期已结束） */
	fullPeriodRecordedTotal: number;
}

interface CompareAnalysis {
	previous: CompareItem;
	lastYear: CompareItem;
	current: CurrentPeriod;
}

/** analysis 返回类型 */
export interface AnalysisResult {
	common: CommonAnalysis;
	predict?: PredictAnalysis;
	compare?: CompareAnalysis;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const AVG_DAYS_PER_MONTH = 30.436875; // 365.2425 / 12
const AVG_DAYS_PER_YEAR = 365.2425;

export const analysisBills = async (
	fetchBills: (r: [number, number]) => Promise<Bill[]>,
	dateRange: [number, number],
	analysisUnit?: "year" | "month" | "week" | "day",
): Promise<AnalysisResult> => {
	const [startMs, endMs] = dateRange;
	if (startMs >= endMs) {
		throw new Error("dateRange start must be < end");
	}

	const billsInRange = await fetchBills([startMs, endMs]);

	// total in given set
	const sumAmounts = (bs: Bill[]) =>
		bs.reduce((s, b) => s + (b.amount || 0), 0);

	const total = sumAmounts(billsInRange);

	// common metrics: dayAvg / monthAvg / yearAvg computed from the provided dateRange span
	const startDay = dayjs(startMs);
	const endDay = dayjs(endMs);

	// compute exact length in days (as float)
	const days = (endMs - startMs) / MS_PER_DAY;
	const safeDays = days > 0 ? days : 1; // 防止除以0

	const dayAvg = total / safeDays;
	const monthAvg = total / (safeDays / AVG_DAYS_PER_MONTH);
	const yearAvg = total / (safeDays / AVG_DAYS_PER_YEAR);

	const result: Record<string, any> = {
		common: {
			total,
			days: safeDays,
			dayAvg,
			monthAvg,
			yearAvg,
		},
	};

	// 如果没有提供 analysisUnit，则只需返回 common 数据
	if (!analysisUnit) return result as AnalysisResult;

	// ------------------------
	// 基于 analysisUnit 计算：predict 与 compare
	// 只计算当前 period 与 previous period（以及去年同期）
	// ------------------------
	// 计算当前 period 的 start/end（end 为 period 的理论结束时间，不一定 <= now）
	const now = dayjs();

	const getPeriodBounds = (
		reference: dayjs.Dayjs,
		unit: typeof analysisUnit,
	) => {
		switch (unit) {
			case "day": {
				const s = reference.startOf("day");
				const e = s.add(1, "day");
				return [s, e] as const;
			}
			case "week": {
				const s = reference.startOf("week");
				const e = s.add(1, "week");
				return [s, e] as const;
			}
			case "month": {
				const s = reference.startOf("month");
				const e = s.add(1, "month");
				return [s, e] as const;
			}
			case "year": {
				const s = reference.startOf("year");
				const e = s.add(1, "year");
				return [s, e] as const;
			}
			default:
				throw new Error("unsupported unit");
		}
	};

	// current period that contains "now" (以 now 所在的 period 为当前周期)
	const [currStart, currEnd] = getPeriodBounds(now, analysisUnit);
	// previous period immediately before current
	const prevStart = currStart.clone().subtract(1, analysisUnit);
	const prevEnd = currStart.clone(); // previous ends when current starts
	// same period last year: shift by -1 year keeping same unit span
	const lastYearStart = currStart.clone().subtract(1, "year");
	const lastYearEnd = currEnd.clone().subtract(1, "year");

	// fetch bills for needed ranges (optimize: only fetch these ranges)
	// convert to ms and ensure we cast to integers
	const rangesToFetch: Array<[number, number]> = [
		[currStart.valueOf(), currEnd.valueOf()],
		[prevStart.valueOf(), prevEnd.valueOf()],
		[lastYearStart.valueOf(), lastYearEnd.valueOf()],
	];

	// fetch each (in parallel)
	const [currBills, prevBills, lastYearBills] = await Promise.all(
		rangesToFetch.map((r) => fetchBills(r)),
	);

	const currTotalFullPeriod = sumAmounts(currBills);
	const prevTotal = prevBills.length ? sumAmounts(prevBills) : 0;
	const lastYearTotal = lastYearBills.length ? sumAmounts(lastYearBills) : 0;

	// Predict: 对于当前周期（可能尚未结束），计算到目前为止的消费并投影到完整周期
	// period length in ms and elapsed ms
	const periodStartMs = currStart.valueOf();
	const periodEndMs = currEnd.valueOf();
	const periodLengthMs = periodEndMs - periodStartMs;
	const elapsedMs = Math.min(Date.now(), periodEndMs) - periodStartMs;
	const elapsedMsSafe = elapsedMs > 0 ? elapsedMs : 0.0001; // 避免0

	// bills that actually occurred before "now" within current period
	const currBillsSoFar = currBills.filter((b) => b.time < Date.now());
	const currTotalSoFar = sumAmounts(currBillsSoFar);

	// projected = currTotalSoFar / elapsedMs * periodLengthMs
	const projectedTotal =
		elapsedMsSafe > 0
			? (currTotalSoFar / elapsedMsSafe) * periodLengthMs
			: currTotalSoFar;

	// Compare: use projectedTotal (如果当前周期未结束) 与 previous period的实际总额比较
	// previousChangePct = (projected - previous) / previous * 100
	const safePct = (a: number, b: number) => {
		// return null when b is 0 (无法计算增幅)，否则返回百分比
		if (b === 0) return null;
		return ((a - b) / Math.abs(b)) * 100;
	};

	const previousChangePct =
		prevTotal === 0 ? null : safePct(projectedTotal, prevTotal);
	const lastYearChangePct =
		lastYearTotal === 0 ? null : safePct(projectedTotal, lastYearTotal);

	result.predict = {
		period: analysisUnit,
		periodStartMs,
		periodEndMs,
		periodLengthMs,
		periodElapsedMs: elapsedMsSafe,
		periodTotalSoFar: currTotalSoFar,
		periodProjectedTotal: projectedTotal,
	};

	result.compare = {
		previous: {
			startMs: prevStart.valueOf(),
			endMs: prevEnd.valueOf(),
			total: prevTotal,
			changePct: previousChangePct, // null 表示无法计算
			absoluteChange: prevTotal === null ? null : projectedTotal - prevTotal,
		},
		lastYear: {
			startMs: lastYearStart.valueOf(),
			endMs: lastYearEnd.valueOf(),
			total: lastYearTotal,
			changePct: lastYearChangePct,
			absoluteChange: projectedTotal - lastYearTotal,
		},
		current: {
			startMs: periodStartMs,
			endMs: periodEndMs,
			totalSoFar: currTotalSoFar,
			projectedTotal,
			fullPeriodRecordedTotal: currTotalFullPeriod, // 如果 period 已结束，这个等于 totalSoFar
		},
	};

	return result as AnalysisResult;
};
