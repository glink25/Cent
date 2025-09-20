// 文件名: chartUtils.ts

import type { ECOption } from "@/components/chart";
import { amountToNumber } from "@/ledger/bill";
import { getDefaultCategoryById } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import { t } from "@/locale";

// --- 1. 数据类型定义 ---
type DisplayType = "income" | "expense" | "balance";

// --- 2. 核心函数：根据参数生成Echarts Option ---

/**
 * 通用函数，用于根据账单数据和配置生成Echarts的option。
 * @param bills 原始的记账数据数组。
 * @param params 配置对象，用于指定要生成的图表类型和相关参数。
 * @param params.chartType 必需，'line', 'multiUserLine', 或 'pie'。
 * @param params.timeRange 可选，用于筛选账单数据的时间范围 [开始时间戳, 结束时间戳]。
 * @param params.displayType 可选，当 chartType 为 'multiUserLine' 时使用，指定显示 'income', 'expense' 或 'balance'。
 */
export function createChartOption(
	bills: Bill[],
	params: {
		chartType: "line" | "multiUserLine" | "pie";
		timeRange?: [number, number];
		displayType?: DisplayType;
	},
) {
	// 数据筛选
	const filteredBills = params.timeRange
		? bills.filter(
			(bill) =>
				bill.time >= params.timeRange![0] &&
				bill.time <= params.timeRange![1],
		)
		: bills;

	// 根据图表类型调用对应的数据处理和option生成函数
	switch (params.chartType) {
		case "line": {
			const dailyData = processDailySummary(filteredBills);
			return createLineChartOption(dailyData);
		}
		case "multiUserLine": {
			if (!params.displayType) {
				throw new Error(
					"对于 'multiUserLine' 图表，必须提供 'displayType' 参数。",
				);
			}
			const multiUserData = processMultiUserSummary(
				filteredBills,
				params.displayType,
			);
			return createMultiUserChartOption(multiUserData, params.displayType);
		}
		case "pie": {
			const pieData = processPieSummary(filteredBills);
			return createPieChartOption(pieData);
		}
		default:
			throw new Error(`未知的图表类型: ${params.chartType}`);
	}
}

// --- 3. 数据处理函数 (内部使用) ---

/** 处理每日收支/结余数据，返回 Echarts dataset 格式 */
function processDailySummary(bills: Bill[]) {
	const dailyMap = new Map<string, { income: number; expense: number }>();
	bills.forEach((bill) => {
		const date = new Date(bill.time).toISOString().slice(0, 10);
		if (!dailyMap.has(date)) dailyMap.set(date, { income: 0, expense: 0 });
		const summary = dailyMap.get(date)!;
		if (bill.type === "income") summary.income += bill.amount;
		else summary.expense += bill.amount;
	});

	const dates = Array.from(dailyMap.keys()).sort();
	const sourceData: (string | number)[][] = [["date", "收入", "支出", "结余"]];
	dates.forEach((date) => {
		const summary = dailyMap.get(date)!;
		const balance = summary.income - summary.expense;
		sourceData.push([
			date,
			amountToNumber(summary.income),
			amountToNumber(summary.expense),
			amountToNumber(balance),
		]);
	});
	return sourceData;
}

/** 处理不同用户的收支/结余数据，返回 Echarts dataset 格式 */
function processMultiUserSummary(bills: Bill[], displayType: DisplayType) {
	const creators = new Set<string>();
	const dailyData = new Map<
		string,
		{
			[creatorId: string]: { income: number; expense: number; balance: number };
		}
	>();

	bills.forEach((bill) => {
		const date = new Date(bill.time).toISOString().slice(0, 10);
		const creatorId = String(bill.creatorId);
		creators.add(creatorId);

		if (!dailyData.has(date)) dailyData.set(date, {});
		if (!dailyData.get(date)![creatorId]) {
			dailyData.get(date)![creatorId] = { income: 0, expense: 0, balance: 0 };
		}

		const data = dailyData.get(date)![creatorId];
		if (bill.type === "income") data.income += bill.amount / 1000;
		else data.expense += bill.amount / 1000;
		data.balance = (data.income - data.expense) / 1000;
	});

	const creatorArray = Array.from(creators).sort();
	const dateArray = Array.from(dailyData.keys()).sort();
	const sourceData: (string | number)[][] = [["date", ...creatorArray]];

	dateArray.forEach((date) => {
		const row: (string | number)[] = [date];
		creatorArray.forEach((creatorId) => {
			const data = dailyData.get(date)![creatorId];
			row.push(data ? data[displayType] : 0);
		});
		sourceData.push(row);
	});

	return sourceData;
}

/** 处理支出类别数据，返回 Echarts dataset 格式 */
function processPieSummary(bills: Bill[]) {
	const categoryMap = new Map<string, number>();
	bills
		.filter((bill) => bill.type === "expense")
		.forEach((bill) => {
			const amount = bill.amount;
			const categoryId = bill.categoryId;
			categoryMap.set(categoryId, (categoryMap.get(categoryId) || 0) + amount);
		});

	const sourceData: (string | number)[][] = [["category", "totalAmount"]];
	categoryMap.forEach((amount, category) => {
		sourceData.push([category, amountToNumber(amount)]);
	});
	return sourceData;
}

// --- 4. Echarts Option 生成函数 (内部使用) ---

function createLineChartOption(sourceData: any[]) {
	return {
		dataset: { source: sourceData },
		title: { text: "收支与结余走势图" },
		tooltip: { trigger: "axis" },
		legend: { orient: "horizontal", bottom: 10 },
		xAxis: { type: "category", axisLabel: { fontSize: 8 } },
		yAxis: { type: "value", axisLabel: { formatter: "{value}", fontSize: 8 } },
		series: [
			{
				name: "收入",
				type: "line",
				encode: { x: "date", y: "收入" },
				smooth: true,
			},
			{
				name: "支出",
				type: "line",
				encode: { x: "date", y: "支出" },
				smooth: true,
			},
			{
				name: "结余",
				type: "line",
				encode: { x: "date", y: "结余" },
				smooth: true,
			},
		],
	} as ECOption;
}

function createMultiUserChartOption(
	sourceData: (string | number)[][],
	displayType: DisplayType,
) {
	const titleMap = {
		income: "不同用户收入走势图",
		expense: "不同用户支出走势图",
		balance: "不同用户结余走势图",
	};
	const nameMap = {
		income: "收入",
		expense: "支出",
		balance: "结余",
	};
	const creators = sourceData[0].slice(1);
	const series = creators.map((creator, index) => ({
		name: creator,
		type: "line",
		smooth: true,
		encode: { x: "date", y: creator },
	}));

	return {
		dataset: { source: sourceData },
		title: { text: titleMap[displayType] },
		tooltip: { trigger: "axis" },
		legend: { orient: "horizontal", bottom: 10 },
		xAxis: { type: "category", axisLabel: { fontSize: 8 } },
		yAxis: {
			type: "value",
			axisLabel: { formatter: `{value}`, fontSize: 8 },
		},
		series: series,
	} as ECOption;
}

function createPieChartOption(sourceData: any[]) {
	return {
		dataset: { source: sourceData },
		title: { text: "支出类别占比图", left: "center" },
		tooltip: {
			trigger: "item",
			fontSize: 8,
			formatter: (_c) => {
				const [categoryId, value] = (_c as any).value
				const category = getDefaultCategoryById(categoryId)
				return `${category ? t(category?.name) : categoryId}: ${value}`
			}
		},
		legend: {
			orient: "vertical",
			right: 10,
			top: "center",
			fontSize: 8,
			formatter: (c: string) => {
				const category = getDefaultCategoryById(c)
				return category ? t(category?.name) : c
			}
		},
		series: [
			{
				type: "pie",
				radius: "60%",
				encode: { itemName: "category", value: "totalAmount" },
				label: {
					show: true,
					fontSize: 8,
					formatter: (c) => {
						const category = getDefaultCategoryById(c.name)
						return category ? t(category?.name) : c.name
					}
				},
				labelLine: { show: true },
			},
		],
	} as ECOption;
}
