import dayjs from "dayjs";
import { amountToNumber, numberToAmount } from "@/ledger/bill";
import { BillCategories } from "@/ledger/category";
import type {
    BillCategory,
    BillFilter,
    BillTag,
    BillType,
    ExportedJSON,
    GlobalMeta,
} from "@/ledger/type";
import { isBillMatched } from "@/ledger/utils";
import { filterOrderedBillListByTimeRangeAnd } from "@/utils/filter";

interface QueryBillsArgs {
    startTime?: string; // ISO 8601 format (YYYY-MM-DD)
    endTime?: string; // ISO 8601 format (YYYY-MM-DD)
    categoryNames?: string[]; // 分类名称列表，支持模糊匹配
    tagNames?: string[]; // 标签名称列表
    keyword?: string; // 搜索备注(comment)中的关键词
    minAmount?: number; // 最小金额（以元为单位）
    maxAmount?: number; // 最大金额（以元为单位）
    billType?: "income" | "expense"; // 筛选收入或支出
}

export function queryBills(args: QueryBillsArgs, data: ExportedJSON) {
    const { items: bills, meta } = data;

    // 获取所有分类（默认分类 + 自定义分类）
    const allCategories: BillCategory[] = [
        ...BillCategories,
        ...(meta.categories ?? []),
    ];

    // 获取所有标签
    const allTags: BillTag[] = meta.tags ?? [];

    // 构建 BillFilter（不包含时间范围，时间范围由 filterOrderedBillListByTimeRangeAnd 处理）
    const filter: BillFilter = {};

    // 转换时间范围（用于 filterOrderedBillListByTimeRangeAnd）
    let startTime: number | undefined;
    let endTime: number | undefined;
    if (args.startTime) {
        startTime = dayjs(args.startTime).startOf("day").valueOf();
    }
    if (args.endTime) {
        endTime = dayjs(args.endTime).endOf("day").valueOf();
    }

    // 转换分类名称到分类ID（支持模糊匹配）
    if (args.categoryNames && args.categoryNames.length > 0) {
        const categoryIds: string[] = [];
        for (const categoryName of args.categoryNames) {
            // 模糊匹配：查找名称包含该字符串的分类
            const matched = allCategories.filter((cat) =>
                cat.name.toLowerCase().includes(categoryName.toLowerCase()),
            );
            categoryIds.push(...matched.map((cat) => cat.id));
        }
        // 去重
        filter.categories = [...new Set(categoryIds)];
    }

    // 转换标签名称到标签ID
    if (args.tagNames && args.tagNames.length > 0) {
        const tagIds: string[] = [];
        for (const tagName of args.tagNames) {
            const matched = allTags.find(
                (tag) => tag.name.toLowerCase() === tagName.toLowerCase(),
            );
            if (matched) {
                tagIds.push(matched.id);
            }
        }
        filter.tags = tagIds;
    }

    // 关键词搜索
    if (args.keyword) {
        filter.comment = args.keyword;
    }

    // 转换金额范围（从元转换为 Amount 类型，需要乘以10000）
    if (args.minAmount !== undefined) {
        filter.minAmountNumber = numberToAmount(args.minAmount);
    }
    if (args.maxAmount !== undefined) {
        filter.maxAmountNumber = numberToAmount(args.maxAmount);
    }

    // 账单类型
    if (args.billType) {
        filter.type = args.billType as BillType;
    }

    // 使用性能更好的 filterOrderedBillListByTimeRangeAnd 进行筛选
    // 账单列表默认按时间降序排列（最新的在前），所以 desc = true
    const matchedBills = filterOrderedBillListByTimeRangeAnd(bills, {
        range: [startTime, endTime],
        interval: "[]", // 闭区间，包含开始和结束时间
        desc: true, // 列表按时间降序排列
        customFilter: (bill) =>
            Boolean(
                isBillMatched(bill, {
                    ...filter,
                    start: undefined,
                    end: undefined,
                }),
            ), // 其他过滤条件
    });

    // 计算总金额统计
    const totalIncome = matchedBills
        .filter((bill) => bill.type === "income")
        .reduce((sum, bill) => sum + bill.amount, 0);

    const totalExpense = matchedBills
        .filter((bill) => bill.type === "expense")
        .reduce((sum, bill) => sum + bill.amount, 0);

    const netAmount = totalIncome - totalExpense;

    return {
        bills: matchedBills,
        statistics: {
            total: matchedBills.length,
            totalIncome,
            totalExpense,
            netAmount,
        },
    };
}

/**
 * 获取账本元数据，包含所有可用的分类树结构和标签列表
 */
export function getAccountMeta(meta: GlobalMeta) {
    // 获取所有分类（默认分类 + 自定义分类）
    const allCategories: BillCategory[] = [
        ...BillCategories,
        ...(meta.categories ?? []),
    ];

    // 获取所有标签
    const allTags: BillTag[] = meta.tags ?? [];

    // 构建分类树结构（按父分类分组）
    const categoryTree: Record<string, BillCategory[]> = {};
    const rootCategories: BillCategory[] = [];

    for (const category of allCategories) {
        if (category.parent) {
            if (!categoryTree[category.parent]) {
                categoryTree[category.parent] = [];
            }
            categoryTree[category.parent].push(category);
        } else {
            rootCategories.push(category);
        }
    }

    return {
        categories: {
            all: allCategories,
            tree: categoryTree,
            roots: rootCategories,
        },
        tags: allTags,
        currencies: meta.customCurrencies ?? [],
    };
}

// ==========================================
// 1. 类型定义
// ==========================================

/** 分析工具的入参 */
export interface AnalyzeBillsArgs extends QueryBillsArgs {
    /** 分组维度: 默认 category */
    groupBy?: "category" | "tag" | "day" | "month" | "year" | "type";
    /** 返回前 N 项数据，剩余合并为 Others */
    limit?: number;
    /** 是否包含时间趋势数据 */
    includeTrend?: boolean;
}

/** 返回给大模型的数据结构 */
export interface AnalysisResult {
    meta: {
        totalAmount: number;
        count: number;
        currency: string;
        dateRange: string;
    };
    /** 分组统计结果 (Token 友好的核心数据) */
    distribution: Array<{
        name: string;
        amount: number;
        percentage: string;
        count: number;
    }>;
    /** 趋势数据 (可选) */
    trend?: Array<{
        date: string;
        amount: number;
    }>;
}

// ==========================================
// 2. 辅助函数
// ==========================================

// 将数据库存储的整数金额转换为实际金额 (10000 -> 1)
const toUnitAmount = (amount: number) => amount / 10000;

// 获取分类名称映射 Map
const getCategoryMap = (categories: BillCategory[] = []) => {
    return categories.reduce(
        (acc, cur) => {
            acc[cur.id] = cur.name;
            return acc;
        },
        {} as Record<string, string>,
    );
};

// 获取标签名称映射 Map
const getTagMap = (tags: BillTag[] = []) => {
    return tags.reduce(
        (acc, cur) => {
            acc[cur.id] = cur.name;
            return acc;
        },
        {} as Record<string, string>,
    );
};

// ==========================================
// 3. 核心分析函数
// ==========================================

export function analyzeBills(
    args: AnalyzeBillsArgs,
    data: ExportedJSON,
): AnalysisResult {
    const {
        groupBy = "category",
        limit = 10,
        includeTrend = false,
        ...filters
    } = args;

    // 1. 获取基础数据 (复用现有的筛选逻辑)
    // 注意：queryBills 返回的是 { bills: [], statistics: {} }
    const { bills, statistics } = queryBills(filters, data);

    // 2. 准备元数据查找表
    const allCategories = [
        ...(data.meta.categories ?? []),
        // 假设 BillCategories 是从全局导入的默认分类
        // ...BillCategories
    ];
    // 注意：这里需要确保你能获取到所有分类，包括默认分类。
    // 如果 BillCategories 无法在此处直接导入，建议通过 data.meta 传递或合并。

    const categoryNameMap = getCategoryMap(allCategories);
    const tagNameMap = getTagMap(data.meta.tags);

    // 3. 聚合计算 (Aggregation)
    const groups: Record<string, { amount: number; count: number }> = {};
    const trendMap: Record<string, number> = {};

    bills.forEach((bill) => {
        const amount = toUnitAmount(bill.amount);

        // --- A. 处理分组逻辑 ---
        let key = "Unknown";

        if (groupBy === "category") {
            key = categoryNameMap[bill.categoryId] || "Unknown Category";
        } else if (groupBy === "tag") {
            // 特殊处理：如果按标签分组，一笔账单可能有多个标签
            // 策略：如果没有标签，归为 "No Tag"
            // 如果有标签，这笔金额会在多个标签中重复统计 (这是标签分析的常规做法)，或者你可以选择只取第一个
            if (!bill.tagIds || bill.tagIds.length === 0) {
                key = "No Tag";
                if (!groups[key]) groups[key] = { amount: 0, count: 0 };
                groups[key].amount += amount;
                groups[key].count += 1;
            } else {
                bill.tagIds.forEach((tagId) => {
                    const tagName = tagNameMap[tagId] || "Unknown Tag";
                    if (!groups[tagName])
                        groups[tagName] = { amount: 0, count: 0 };
                    groups[tagName].amount += amount;
                    groups[tagName].count += 1;
                });
                key = ""; // 已经处理过了，跳过下面的通用累加
            }
        } else if (groupBy === "day") {
            key = dayjs(bill.time).format("YYYY-MM-DD");
        } else if (groupBy === "month") {
            key = dayjs(bill.time).format("YYYY-MM");
        } else if (groupBy === "year") {
            key = dayjs(bill.time).format("YYYY");
        } else if (groupBy === "type") {
            key = bill.type === "expense" ? "支出" : "收入";
        }

        // 通用累加 (除了 Tag 特殊处理外)
        if (key) {
            if (!groups[key]) groups[key] = { amount: 0, count: 0 };
            groups[key].amount += amount;
            groups[key].count += 1;
        }

        // --- B. 处理趋势数据 (如果是按时间分组，直接复用 groups 即可，不需要重复计算) ---
        if (includeTrend) {
            // 默认趋势按“天”或者“月”聚合，取决于数据跨度，这里简化默认为按天
            const trendKey = dayjs(bill.time).format("YYYY-MM-DD");
            trendMap[trendKey] = (trendMap[trendKey] || 0) + amount;
        }
    });

    // 4. 排序与截断 (Top N + Others)
    const sortedGroups = Object.entries(groups)
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.amount - a.amount); // 按金额降序

    const topN = sortedGroups.slice(0, limit);
    const others = sortedGroups.slice(limit);

    // 处理 Others
    if (others.length > 0) {
        const othersStat = others.reduce(
            (acc, cur) => ({
                amount: acc.amount + cur.amount,
                count: acc.count + cur.count,
            }),
            { amount: 0, count: 0 },
        );
        topN.push({
            name: "Others",
            amount: othersStat.amount,
            count: othersStat.count,
        });
    }

    // 计算百分比
    const totalCalculatedAmount = topN.reduce(
        (sum, item) => sum + item.amount,
        0,
    );
    const finalDistribution = topN.map((item) => ({
        ...item,
        amount: Number(item.amount.toFixed(2)), // 保留两位小数
        percentage:
            totalCalculatedAmount === 0
                ? "0%"
                : `${((item.amount / totalCalculatedAmount) * 100).toFixed(1)}%`,
    }));

    // 5. 组装趋势数据 (按时间排序)
    let trendResult: AnalysisResult["trend"];
    if (includeTrend) {
        trendResult = Object.entries(trendMap)
            .map(([date, amount]) => ({
                date,
                amount: Number(amount.toFixed(2)),
            }))
            .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf());
    }

    // 6. 返回结果
    const result = {
        meta: {
            // 使用 filters 里的 billType 决定总额是净额还是特定类型，或者直接返回筛选出的总和
            totalAmount: Number(
                toUnitAmount(
                    filters.billType === "income"
                        ? statistics.totalIncome
                        : filters.billType === "expense"
                          ? statistics.totalExpense
                          : statistics.totalIncome - statistics.totalExpense, // 如果未指定类型，这里可能返回净额
                ).toFixed(2),
            ),
            count: statistics.total,
            currency: data.meta.baseCurrency || "CNY",
            dateRange:
                filters.startTime && filters.endTime
                    ? `${filters.startTime} to ${filters.endTime}`
                    : "All Time",
        },
        distribution: finalDistribution,
        trend: trendResult,
    };

    // 将amount转换为实际金额
    return result;
}
