import { amountToNumber } from "@/ledger/bill";
import type { Bill } from "@/ledger/type";

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
    getUserInfo?: (creatorId: string | number) => { id: string | number; name: string };
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
}

/**
 * 格式化日期为 YYYY-MM-DD
 * @param timestamp 时间戳
 * @returns 格式化后的日期字符串
 */
function formatDate(timestamp: number): string {
    const date = new Date(timestamp);
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * 一次性处理账单数据，生成所有ECharts图表所需的数据结构
 * @param options 包含账单和配置函数的选项对象
 * @returns 包含所有图表数据的对象
 */
export function processBillDataForCharts(options: ProcessBillDataOptions): ProcessedChartData {
    const { bills, getMajorCategory, getUserInfo } = options;
    const TOTAL_KEY = '__TOTAL__'; // 用于标识总体的特殊key

    // 1. 初始化中间聚合数据结构

    // 时间序列数据: Map<date, Map<creatorId | '__TOTAL__', { income, expense }>>
    const timeSeriesData = new Map<string, Map<string, { income: number; expense: number }>>();

    // 分类总计: Map<majorCategoryId, amount>
    const expenseCategoryTotals = new Map<string, { name: string; total: number }>();
    const incomeCategoryTotals = new Map<string, { name: string; total: number }>();

    // 用户总计: Map<creatorId, { income, expense }>
    const userTotals = new Map<string, { income: number; expense: number }>();

    let highestIncomeBill: Bill | null = null;
    let highestExpenseBill: Bill | null = null;
    let highestIncomeAmount = -1;
    let highestExpenseAmount = -1;

    // 2. 一次循环遍历，填充聚合数据
    for (const bill of bills) {
        const amount = amountToNumber(bill.amount);
        const dateStr = formatDate(bill.time);
        const creatorId = String(bill.creatorId);

        // --- a. 更新时间序列数据 ---
        if (!timeSeriesData.has(dateStr)) {
            timeSeriesData.set(dateStr, new Map());
        }
        const dailyData = timeSeriesData.get(dateStr)!;

        // 更新总体数据
        if (!dailyData.has(TOTAL_KEY)) dailyData.set(TOTAL_KEY, { income: 0, expense: 0 });
        // 更新用户数据
        if (!dailyData.has(creatorId)) dailyData.set(creatorId, { income: 0, expense: 0 });

        const totalDaily = dailyData.get(TOTAL_KEY)!;
        const userDaily = dailyData.get(creatorId)!;

        // --- b. 根据账单类型进行聚合 ---
        if (bill.type === 'income') {
            totalDaily.income += amount;
            userDaily.income += amount;

            // 更新收入分类总计
            const majorCategory = getMajorCategory(bill.categoryId);
            if (!incomeCategoryTotals.has(majorCategory.id)) {
                incomeCategoryTotals.set(majorCategory.id, { name: majorCategory.name, total: 0 });
            }
            incomeCategoryTotals.get(majorCategory.id)!.total += amount;

            // 更新用户总收入
            if (!userTotals.has(creatorId)) userTotals.set(creatorId, { income: 0, expense: 0 });
            userTotals.get(creatorId)!.income += amount;

            // 更新最高收入记录
            if (amount > highestIncomeAmount) {
                highestIncomeAmount = amount;
                highestIncomeBill = bill;
            }
        } else { // expense
            totalDaily.expense += amount;
            userDaily.expense += amount;

            // 更新支出分类总计
            const majorCategory = getMajorCategory(bill.categoryId);
            if (!expenseCategoryTotals.has(majorCategory.id)) {
                expenseCategoryTotals.set(majorCategory.id, { name: majorCategory.name, total: 0 });
            }
            expenseCategoryTotals.get(majorCategory.id)!.total += amount;

            // 更新用户总支出
            if (!userTotals.has(creatorId)) userTotals.set(creatorId, { income: 0, expense: 0 });
            userTotals.get(creatorId)!.expense += amount;

            // 更新最高支出记录
            if (amount > highestExpenseAmount) {
                highestExpenseAmount = amount;
                highestExpenseBill = bill;
            }
        }
    }

    // 3. 将聚合后的中间数据转换为ECharts格式

    // --- a. 准备时间和用户维度 ---
    const sortedDates = Array.from(timeSeriesData.keys()).sort();
    const userIds = Array.from(userTotals.keys());
    const userNames = userIds.map(id => (getUserInfo ? getUserInfo(id).name : id));

    // --- b. 转换时间序列数据 (图表 1-4) ---
    const overallTrendSource: EchartsDatasetSource = [['date', '收入', '支出', '结余']];
    const userExpenseSource: EchartsDatasetSource = [['date', ...userNames]];
    const userIncomeSource: EchartsDatasetSource = [['date', ...userNames]];
    const userBalanceSource: EchartsDatasetSource = [['date', ...userNames]];

    let cumulativeBalance = 0;
    const userCumulativeBalances = new Map<string, number>(userIds.map(id => [id, 0]));

    for (const date of sortedDates) {
        const dailyData = timeSeriesData.get(date)!;
        const totalDaily = dailyData.get(TOTAL_KEY) || { income: 0, expense: 0 };

        cumulativeBalance += totalDaily.income - totalDaily.expense;
        overallTrendSource.push([date, totalDaily.income, totalDaily.expense, cumulativeBalance]);

        const expenseRow: (string | number)[] = [date];
        const incomeRow: (string | number)[] = [date];
        const balanceRow: (string | number)[] = [date];

        for (const userId of userIds) {
            const userDaily = dailyData.get(userId) || { income: 0, expense: 0 };
            expenseRow.push(userDaily.expense);
            incomeRow.push(userDaily.income);

            const currentUserBalance = userCumulativeBalances.get(userId)! + userDaily.income - userDaily.expense;
            userCumulativeBalances.set(userId, currentUserBalance);
            balanceRow.push(currentUserBalance);
        }
        userExpenseSource.push(expenseRow);
        userIncomeSource.push(incomeRow);
        userBalanceSource.push(balanceRow);
    }

    // --- c. 转换饼图数据 (图表 5-9) ---
    const expenseStructure: PieChartDataItem[] = Array.from(expenseCategoryTotals.values())
        .map(item => ({ name: item.name, value: item.total }));

    const incomeStructure: PieChartDataItem[] = Array.from(incomeCategoryTotals.values())
        .map(item => ({ name: item.name, value: item.total }));

    const userIncomeStructure: PieChartDataItem[] = [];
    const userExpenseStructure: PieChartDataItem[] = [];
    const userBalanceStructure: PieChartDataItem[] = [];

    for (const userId of userIds) {
        const totals = userTotals.get(userId)!;
        const name = getUserInfo ? getUserInfo(userId).name : userId;
        userIncomeStructure.push({ name, value: totals.income });
        userExpenseStructure.push({ name, value: totals.expense });
        userBalanceStructure.push({ name, value: totals.income - totals.expense });
    }

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
    };
}