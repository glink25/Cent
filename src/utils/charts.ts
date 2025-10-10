import type { ECOption } from "@/components/chart";
import { amountToNumber } from "@/ledger/bill";
import type { Bill, BillType } from "@/ledger/type";
import dayjs, { type OpUnitType } from "dayjs";
import { merge } from "lodash-es";

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
	getCategory: (categoryId: string) => {
		id: string;
		name: string;
		parent: { id: string; name: string };
	};
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
	// 二级分类结构图
	subCategoryStructure: Record<string, PieChartDataItem[]>;
	// tag结构图
	tagStructure: Map<string, { income: number; expense: number }>;
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
	t: any,
): ProcessedChartData {
	const { bills, getCategory, getUserInfo, gap: _gap } = options;
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
	const subCategoryTotals = new Map<
		string,
		Record<string, { name: string; total: number }>
	>();
	const tagStructure = new Map<string, { income: number; expense: number }>();
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
		const categoryDetail = getCategory(bill.categoryId);
		const majorCategory = categoryDetail.parent;
		// --- b. 根据账单类型进行聚合 ---
		if (bill.type === "income") {
			totalDaily.income += amount;
			userDaily.income += amount;

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
		// -- c. 二级分类聚合
		if (!subCategoryTotals.has(majorCategory.id)) {
			subCategoryTotals.set(majorCategory.id, {});
		}

		subCategoryTotals.get(majorCategory.id)![categoryDetail.id] = {
			name: categoryDetail.name,
			total:
				(subCategoryTotals.get(majorCategory.id)![categoryDetail.id]?.total ??
					0) + amount,
		};

		// -- d. tag聚合
		bill.tagIds?.forEach((tagId) => {
			if (!tagStructure.has(tagId)) {
				tagStructure.set(tagId, {
					income: 0,
					expense: 0,
				});
				if (bill.type === "income") {
					tagStructure.get(tagId)!.income += amount;
				} else {
					tagStructure.get(tagId)!.expense += amount;
				}
			}
		});
	}

	// 3. 将聚合后的整数数据转换为ECharts格式，在此阶段调用 amountToNumber

	const sortedDates = Array.from(timeSeriesData.keys()).sort();
	const userIds = Array.from(userTotals.keys());
	const userNames = userIds.map((id) =>
		getUserInfo ? getUserInfo(id).name : id,
	);

	const overallTrendSource: EchartsDatasetSource = [
		["date", t("income"), t("expense"), t("Balance")],
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

			expenseRow.push(amountToNumber(userDaily.expense));
			incomeRow.push(amountToNumber(userDaily.income));

			const currentUserBalance =
				userCumulativeBalances.get(userId)! +
				userDaily.income -
				userDaily.expense;
			userCumulativeBalances.set(userId, currentUserBalance);
			balanceRow.push(amountToNumber(currentUserBalance));
		}
		userExpenseSource.push(expenseRow);
		userIncomeSource.push(incomeRow);
		userBalanceSource.push(balanceRow);
	}

	const expenseStructure: PieChartDataItem[] = Array.from(
		expenseCategoryTotals.values(),
	).map((item) => ({ name: item.name, value: amountToNumber(item.total) }));

	const incomeStructure: PieChartDataItem[] = Array.from(
		incomeCategoryTotals.values(),
	).map((item) => ({ name: item.name, value: amountToNumber(item.total) }));
	const subCategoryStructure: Record<string, PieChartDataItem[]> =
		Object.fromEntries(
			Array.from(subCategoryTotals.entries()).map(
				([majorCategoryId, totals]) => {
					return [
						majorCategoryId,
						Array.from(Object.values(totals)).map((item) => ({
							name: item.name,
							value: amountToNumber(item.total),
						})),
					];
				},
			),
		);

	const userIncomeStructure: PieChartDataItem[] = [];
	const userExpenseStructure: PieChartDataItem[] = [];
	const userBalanceStructure: PieChartDataItem[] = [];

	for (const userId of userIds) {
		const totals = userTotals.get(userId)!;
		const name = getUserInfo ? getUserInfo(userId).name : userId;
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

	tagStructure.values().forEach((v) => {
		v.income = amountToNumber(v.income);
		v.expense = amountToNumber(v.expense);
	});

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
		subCategoryStructure,
		tagStructure,
	};
}

export const overallTrendOption = (
	dataset: { source: any[] },
	options?: ECOption,
) =>
	merge(
		{
			// 提示框，'axis' 表示鼠标悬浮在x轴上时触发
			tooltip: {
				trigger: "axis",
			},
			// 图例，用于筛选系列
			legend: {
				// ECharts 会自动从 dataset.source 的第一行读取图例名称
				// ['date', '收入', '支出', '结余'] -> '收入', '支出', '结余'
			},
			// ECharts 的数据核心
			dataset: dataset,
			// x轴配置，type: 'category' 表示类目轴
			// ECharts 会自动将 dataset 的第一列 ('date') 映射到 x 轴
			xAxis: {
				type: "category",
				boundaryGap: false, // 折线图建议设为 false，让线贴近y轴
			},
			// y轴配置，type: 'value' 表示数值轴
			yAxis: {
				type: "value",
			},
			// 系列列表，定义了图表中的每一条线（或其他图形）
			series: [
				// ECharts 会自动将 dataset 的第二列('收入')映射到第一个系列
				{ type: "line", smooth: true },
				// 第三列('支出')映射到第二个系列
				{ type: "line", smooth: true },
				// 第四列('结余')映射到第三个系列
				{ type: "line", smooth: true },
			],
		},
		options,
	);

/**
 * 通用的趋势图 ECharts Option 生成器
 * @param title - 图表标题
 * @param dataset - 包含 source 的数据集
 * @param options - 自定义配置
 * @returns ECharts Option
 */
export const userTrendOption = (
	dataset: { source: (string | number)[][] },
	options?: ECOption,
): ECOption => {
	const seriesCount = dataset.source[0].length - 1;

	const baseOption: ECOption = {
		tooltip: { trigger: "axis" },
		legend: {},
		dataset: dataset,
		xAxis: { type: "category", boundaryGap: false },
		yAxis: { type: "value" },
		series: Array.from({ length: seriesCount }, (_, i) => ({
			type: "line",
			smooth: true,
			name: dataset.source[0][i + 1], // 系列名称，用于图例和 tooltip
			encode: {
				x: "date", // 映射到 dataset 中的 'date' 列
				y: dataset.source[0][i + 1], // 映射到 dataset 中的 'glink25' 列
			},
		})),
	};

	return merge(baseOption, options);
};

export const structureOption = (dataset: any[], options?: ECOption) =>
	merge(
		{
			title: {
				text: "支出结构",
				left: "center", // 标题居中
			},
			// 提示框，'item' 表示鼠标悬浮在数据项（扇区）上时触发
			tooltip: {
				trigger: "item",
				// 格式化提示内容：a(系列名), b(数据项名), c(数值), d(百分比)
				formatter: "{b}: {c} ({d}%)",
			},
			legend: {
				orient: "vertical", // 图例垂直排列
				left: "left", // 靠左放置
			},
			series: [
				{
					name: "支出类型", // 系列名称，会在 tooltip 中显示
					type: "pie",
					center: ["55%", "50%"],
					radius: "55%", // 饼图半径
					labelLine: {
						show: true,
						length: 10, // 第一段（直线段）长度 20px 或 20（单位取决于版本 / 语法上下文）
						length2: 10, // 第二段（拐弯 / 水平延伸）长度 30px
						lineStyle: {
							width: 1,
							type: "solid",
							color: "#aaa",
						},
						smooth: 0.2, // 可选，让折线有点圆弧过渡
					},
					// 直接使用我们生成的 { name, value } 格式的数据
					data: dataset,
					emphasis: {
						// 高亮状态下的样式
						itemStyle: {
							shadowBlur: 10,
							shadowOffsetX: 0,
							shadowColor: "rgba(0, 0, 0, 0.5)",
						},
					},
				},
			],
		},
		options,
	);
