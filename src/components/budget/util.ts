import type { Dayjs } from "dayjs";
import { amountToNumber } from "@/ledger/bill";
import type { Bill } from "@/ledger/type";
import { filterOrderedBillListByTimeRange } from "@/utils/filter";
import { toDayjs } from "@/utils/time";
import type { EditBudget } from "./type";

export const budgetTotal = (budget: EditBudget) =>
	budget.totalBudget +
	(budget.categoriesBudget?.reduce((p, c) => p + c.budget, 0) ?? 0);

export const budgetRange = (
	budget: EditBudget,
	_now?: number | Dayjs,
): [[Dayjs, Dayjs][], [Dayjs, Dayjs] | null] => {
	const now = toDayjs(_now ?? Date.now()).startOf("day");
	const startDate = toDayjs(budget.start).startOf("day");
	const endDate = budget.end ? toDayjs(budget.end).endOf("day") : null;

	const ranges: [Dayjs, Dayjs][] = [];
	let currentRange: [Dayjs, Dayjs] | null = null;

	// 处理重复周期
	const { unit, value } = budget.repeat;
	let rangeStart = startDate;

	// 限制最大迭代次数，防止无限循环
	const MAX_ITERATIONS = 10000;
	let iterationCount = 0;

	// 循环的退出条件：1. 超出预算结束日期；2. 已经找到当前周期且不再需要计算更多周期；3. 达到最大迭代次数
	while (endDate === null || rangeStart.isSameOrBefore(endDate)) {
		if (++iterationCount > MAX_ITERATIONS) {
			console.warn("防止无限循环，迭代次数已达到上限。");
			break;
		}

		let rangeEnd: Dayjs;
		// 使用 add() 和 subtract(1, 'day') 确保范围的边界准确
		if (unit === "month") {
			rangeEnd = rangeStart.add(value, "month").subtract(1, "day");
		} else if (unit === "year") {
			rangeEnd = rangeStart.add(value, "year").subtract(1, "day");
		} else {
			// 'week' or 'day'
			rangeEnd = rangeStart.add(value, unit).subtract(1, "day");
		}

		// 如果计算出的周期结束日期超过了预算的结束日期，则截断
		if (endDate && rangeEnd.isAfter(endDate)) {
			rangeEnd = endDate;
		}

		const isNowInRange = now.isBetween(rangeStart, rangeEnd, null, "[]");

		if (isNowInRange) {
			currentRange = [rangeStart, rangeEnd];
		}

		ranges.push([rangeStart, rangeEnd]);

		// 如果已经找到当前周期，并且当前周期是最后一个，或者已经超出了 _now 日期，则停止循环
		if (currentRange && rangeStart.isAfter(currentRange[0])) {
			break;
		}

		// 更新下一个周期的开始日期
		rangeStart = rangeStart.add(value, unit);
	}

	return [ranges, currentRange];
};

export const budgetEncountered = (
	budget: EditBudget,
	bills: Bill[],
	currentRange: [Dayjs, Dayjs],
) => {
	const filtered = filterOrderedBillListByTimeRange(bills, currentRange);
	let totalUsed = 0;
	const categoriesUsed = budget.categoriesBudget?.map((c) => ({
		id: c.id,
		used: 0,
	}));
	filtered.forEach((bill) => {
		if (bill.type === "income") {
			return;
		}
		totalUsed += bill.amount;
		const found = categoriesUsed?.find((c) => c.id === bill.categoryId);
		if (found) {
			found.used += bill.amount;
		}
	}, []);
	return {
		totalUsed: amountToNumber(totalUsed),
		categoriesUsed: categoriesUsed?.map((v) => ({
			...v,
			used: amountToNumber(v.used),
		})),
	};
};
