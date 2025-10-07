import { amountToNumber } from "@/ledger/bill";
import type { Bill } from "@/ledger/type";
import dayjs, { type OpUnitType } from "dayjs";

/**
 * 处理器函数的选项
 */
export interface ProcessBillDataOptions {
	/**
	 * 账单列表
	 */
	bills: Bill[];
	/**
	 * 将子分类ID映射到其父分类信息的函数
	 * @param categoryId 子分类ID
	 * @returns 返回一个包含父分类ID和名称的对象
	 */
	getMajorCategory: (categoryId: string) => { id: string; name: string };
	/**
	 * (可选) 根据用户ID获取用户信息的函数，用于图表图例显示
	 * @param creatorId 用户ID
	 * @returns 返回包含用户信息的对象，例如 { id, name }
	 */
	getUserInfo?: (creatorId: string | number) => {
		id: string | number;
		name: string;
	};
	gap?: OpUnitType;
}

// --- 定义我们函数的输出结构 ---

/**
 * ECharts 饼图数据项格式
 */
export interface PieChartDataItem {
	value: number;
	name: string;
}

/**
 * ECharts Dataset 数据源格式
 * 例如:
 * [
 * ['date', '收入', '支出', '结余'],
 * ['2025-09-21', 120, 80, 40],
 * ['2025-09-22', 200, 50, 190],
 * ]
 */
export type EchartsDatasetSource = (string | number)[][];

/**
 * 最终处理完成的图表数据
 */
export interface ProcessedChartData {
	// 总体趋势图 (图表1)
	overallTrend: {
		source: EchartsDatasetSource;
	};
	// 用户支出趋势图 (图表2)
	userExpenseTrend: {
		source: EchartsDatasetSource;
	};
	// 用户收入趋势图 (图表3)
	userIncomeTrend: {
		source: EchartsDatasetSource;
	};
	// 用户结余趋势图 (图表4)
	userBalanceTrend: {
		source: EchartsDatasetSource;
	};
	// 支出结构图 (图表5)
	expenseStructure: PieChartDataItem[];
	// 收入结构图 (图表6)
	incomeStructure: PieChartDataItem[];
	// 用户收入结构图 (图表7)
	userIncomeStructure: PieChartDataItem[];
	// 用户支出结构图 (图表8)
	userExpenseStructure: PieChartDataItem[];
	// 用户结余结构图 (图表9)
	userBalanceStructure: PieChartDataItem[];
	// 额外数据
	highestExpenseBill: Bill | null;
	highestIncomeBill: Bill | null;
	total: {
		income: number;
		expense: number;
		balance: number;
	};
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param timestamp 时间戳
 * @param gap 最小时间单位
 * @returns 格式化后的日期字符串
 */
function formatDate(timestamp: number, gap: OpUnitType = "day"): string {
	const date = dayjs.unix(timestamp / 1000).startOf(gap);
	return date.format("YYYY-MM-DD");
	// const date = new Date(timestamp);
	// const year = date.getFullYear();
	// const month = (date.getMonth() + 1).toString().padStart(2, "0");
	// const day = date.getDate().toString().padStart(2, "0");
	// return `${year}-${month}-${day}`;
}

/**
 * 一次性处理账单数据，生成所有ECharts图表所需的数据结构 (修正版)
 * @param options 包含账单和配置函数的选项对象
 * @returns 包含所有图表数据的对象
 */
export function processBillDataForCharts(
	options: ProcessBillDataOptions,
): ProcessedChartData {
	const { bills, getMajorCategory, getUserInfo, gap: _gap } = options;
	const TOTAL_KEY = "__TOTAL__";
	const gap =
		_gap ??
		(bills.length === 0
			? "date"
			: bills[0].time - bills[bills.length - 1].time > 90 * 24 * 60 * 60 * 1000 //账单天数大于90天时按月计算
				? "month"
				: "date");

	// 1. 初始化中间聚合数据结构
	// 所有金额都将以整数形式存储
	const timeSeriesData = new Map<
		string,
		Map<string, { income: number; expense: number }>
	>();
	const expenseCategoryTotals = new Map<
		string,
		{ name: string; total: number }
	>();
	const incomeCategoryTotals = new Map<
		string,
		{ name: string; total: number }
	>();
	const userTotals = new Map<string, { income: number; expense: number }>();

	let highestIncomeBill: Bill | null = null;
	let highestExpenseBill: Bill | null = null;

	// 2. 一次循环遍历，使用整数进行聚合
	for (const bill of bills) {
		// 【修正】直接使用整数 amount
		const amount = bill.amount;
		const dateStr = formatDate(bill.time, gap);
		const creatorId = String(bill.creatorId);

		// --- a. 更新时间序列数据 ---
		if (!timeSeriesData.has(dateStr)) {
			timeSeriesData.set(dateStr, new Map());
		}
		const dailyData = timeSeriesData.get(dateStr)!;

		if (!dailyData.has(TOTAL_KEY))
			dailyData.set(TOTAL_KEY, { income: 0, expense: 0 });
		if (!dailyData.has(creatorId))
			dailyData.set(creatorId, { income: 0, expense: 0 });

		const totalDaily = dailyData.get(TOTAL_KEY)!;
		const userDaily = dailyData.get(creatorId)!;

		// --- b. 根据账单类型进行聚合 ---
		if (bill.type === "income") {
			totalDaily.income += amount;
			userDaily.income += amount;

			const majorCategory = getMajorCategory(bill.categoryId);
			if (!incomeCategoryTotals.has(majorCategory.id)) {
				incomeCategoryTotals.set(majorCategory.id, {
					name: majorCategory.name,
					total: 0,
				});
			}
			incomeCategoryTotals.get(majorCategory.id)!.total += amount;

			if (!userTotals.has(creatorId))
				userTotals.set(creatorId, { income: 0, expense: 0 });
			userTotals.get(creatorId)!.income += amount;

			// 比较仍然基于整数，是准确的
			if (!highestIncomeBill || amount > highestIncomeBill.amount) {
				highestIncomeBill = bill;
			}
		} else {
			// expense
			totalDaily.expense += amount;
			userDaily.expense += amount;

			const majorCategory = getMajorCategory(bill.categoryId);
			if (!expenseCategoryTotals.has(majorCategory.id)) {
				expenseCategoryTotals.set(majorCategory.id, {
					name: majorCategory.name,
					total: 0,
				});
			}
			expenseCategoryTotals.get(majorCategory.id)!.total += amount;

			if (!userTotals.has(creatorId))
				userTotals.set(creatorId, { income: 0, expense: 0 });
			userTotals.get(creatorId)!.expense += amount;

			if (!highestExpenseBill || amount > highestExpenseBill.amount) {
				highestExpenseBill = bill;
			}
		}
	}

	// 3. 将聚合后的整数数据转换为ECharts格式，在此阶段调用 amountToNumber

	const sortedDates = Array.from(timeSeriesData.keys()).sort();
	const userIds = Array.from(userTotals.keys());
	const userNames = userIds.map((id) =>
		getUserInfo ? getUserInfo(id).name : id,
	);

	const overallTrendSource: EchartsDatasetSource = [
		["date", "收入", "支出", "结余"],
	];
	const userExpenseSource: EchartsDatasetSource = [["date", ...userNames]];
	const userIncomeSource: EchartsDatasetSource = [["date", ...userNames]];
	const userBalanceSource: EchartsDatasetSource = [["date", ...userNames]];

	let cumulativeBalance = 0;
	const userCumulativeBalances = new Map<string, number>(
		userIds.map((id) => [id, 0]),
	);

	const total = {
		expense: 0,
		income: 0,
		balance: 0,
	};

	for (const date of sortedDates) {
		const dailyData = timeSeriesData.get(date)!;
		const totalDaily = dailyData.get(TOTAL_KEY) || { income: 0, expense: 0 };

		cumulativeBalance += totalDaily.income - totalDaily.expense;

		// 【修正】在此处进行转换
		overallTrendSource.push([
			date,
			amountToNumber(totalDaily.income),
			amountToNumber(totalDaily.expense),
			amountToNumber(cumulativeBalance),
		]);
		total.expense += totalDaily.expense;
		total.income += totalDaily.income;

		const expenseRow: (string | number)[] = [date];
		const incomeRow: (string | number)[] = [date];
		const balanceRow: (string | number)[] = [date];

		for (const userId of userIds) {
			const userDaily = dailyData.get(userId) || { income: 0, expense: 0 };

			// 【修正】在此处进行转换
			expenseRow.push(amountToNumber(userDaily.expense));
			incomeRow.push(amountToNumber(userDaily.income));

			const currentUserBalance =
				userCumulativeBalances.get(userId)! +
				userDaily.income -
				userDaily.expense;
			userCumulativeBalances.set(userId, currentUserBalance);
			// 【修正】在此处进行转换
			balanceRow.push(amountToNumber(currentUserBalance));
		}
		userExpenseSource.push(expenseRow);
		userIncomeSource.push(incomeRow);
		userBalanceSource.push(balanceRow);
	}

	// 【修正】在此处进行转换
	const expenseStructure: PieChartDataItem[] = Array.from(
		expenseCategoryTotals.values(),
	).map((item) => ({ name: item.name, value: amountToNumber(item.total) }));

	const incomeStructure: PieChartDataItem[] = Array.from(
		incomeCategoryTotals.values(),
	).map((item) => ({ name: item.name, value: amountToNumber(item.total) }));

	const userIncomeStructure: PieChartDataItem[] = [];
	const userExpenseStructure: PieChartDataItem[] = [];
	const userBalanceStructure: PieChartDataItem[] = [];

	for (const userId of userIds) {
		const totals = userTotals.get(userId)!;
		const name = getUserInfo ? getUserInfo(userId).name : userId;
		// 【修正】在此处进行转换
		userIncomeStructure.push({ name, value: amountToNumber(totals.income) });
		userExpenseStructure.push({ name, value: amountToNumber(totals.expense) });
		userBalanceStructure.push({
			name,
			value: amountToNumber(totals.income - totals.expense),
		});
	}

	//转换total
	total.balance = total.income - total.expense;
	total.expense = amountToNumber(total.expense);
	total.income = amountToNumber(total.income);
	total.balance = amountToNumber(total.balance);

	// 4. 组装并返回最终结果
	return {
		overallTrend: { source: overallTrendSource },
		userExpenseTrend: { source: userExpenseSource },
		userIncomeTrend: { source: userIncomeSource },
		userBalanceTrend: { source: userBalanceSource },
		expenseStructure,
		incomeStructure,
		userIncomeStructure,
		userExpenseStructure,
		userBalanceStructure,
		highestExpenseBill,
		highestIncomeBill,
		total,
	};
}
