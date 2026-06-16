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
import { createBillMatcher } from "@/ledger/utils";
import { filterOrderedBillListByTimeRangeAnd } from "@/utils/filter";

export interface QueryBillsArgs {
    startTime?: string;
    endTime?: string;
    categoryNames?: string[];
    tagNames?: string[];
    keyword?: string;
    minAmount?: number;
    maxAmount?: number;
    billType?: "income" | "expense";
}

export function queryBills(args: QueryBillsArgs, data: ExportedJSON) {
    const { items: bills, meta } = data;
    const allCategories: BillCategory[] = [
        ...BillCategories,
        ...(meta.categories ?? []),
    ];
    const allTags: BillTag[] = meta.tags ?? [];
    const filter: BillFilter = {};

    let startTime: number | undefined;
    let endTime: number | undefined;
    if (args.startTime)
        startTime = dayjs(args.startTime).startOf("day").valueOf();
    if (args.endTime) endTime = dayjs(args.endTime).endOf("day").valueOf();

    if (args.categoryNames?.length) {
        const categoryIds: string[] = [];
        for (const categoryName of args.categoryNames) {
            const matched = allCategories.filter((cat) =>
                cat.name.toLowerCase().includes(categoryName.toLowerCase()),
            );
            categoryIds.push(...matched.map((cat) => cat.id));
        }
        filter.categories = [...new Set(categoryIds)];
    }

    if (args.tagNames?.length) {
        const tagIds: string[] = [];
        for (const tagName of args.tagNames) {
            const matched = allTags.find(
                (tag) => tag.name.toLowerCase() === tagName.toLowerCase(),
            );
            if (matched) tagIds.push(matched.id);
        }
        filter.tags = tagIds;
    }

    if (args.keyword) filter.comment = args.keyword;
    if (args.minAmount !== undefined) {
        filter.minAmountNumber = numberToAmount(args.minAmount);
    }
    if (args.maxAmount !== undefined) {
        filter.maxAmountNumber = numberToAmount(args.maxAmount);
    }
    if (args.billType) filter.type = args.billType as BillType;

    const matcher = createBillMatcher(
        { ...filter, start: undefined, end: undefined },
        {
            categories: allCategories,
            tags: allTags,
            baseCurrency: meta.baseCurrency,
        },
    );
    const matchedBills = filterOrderedBillListByTimeRangeAnd(bills, {
        range: [startTime, endTime],
        interval: "[]",
        desc: true,
        customFilter: matcher,
    });

    const totalIncome = matchedBills
        .filter((bill) => bill.type === "income")
        .reduce((sum, bill) => sum + bill.amount, 0);
    const totalExpense = matchedBills
        .filter((bill) => bill.type === "expense")
        .reduce((sum, bill) => sum + bill.amount, 0);

    return {
        bills: matchedBills,
        statistics: {
            total: matchedBills.length,
            totalIncome,
            totalExpense,
            netAmount: totalIncome - totalExpense,
        },
    };
}

export function getAccountMeta(meta: GlobalMeta) {
    const allCategories: BillCategory[] = [
        ...BillCategories,
        ...(meta.categories ?? []),
    ];
    const allTags: BillTag[] = meta.tags ?? [];
    const categoryTree: Record<string, BillCategory[]> = {};
    const rootCategories: BillCategory[] = [];

    for (const category of allCategories) {
        if (category.parent) {
            if (!categoryTree[category.parent])
                categoryTree[category.parent] = [];
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

export interface AnalyzeBillsArgs extends QueryBillsArgs {
    groupBy?: "category" | "tag" | "day" | "month" | "year" | "type";
    limit?: number;
    includeTrend?: boolean;
}

export interface AnalysisResult {
    meta: {
        totalAmount: number;
        count: number;
        currency: string;
        dateRange: string;
    };
    distribution: Array<{
        name: string;
        amount: number;
        percentage: string;
        count: number;
    }>;
    trend?: Array<{
        date: string;
        amount: number;
    }>;
}

const toUnitAmount = (amount: number) => amountToNumber(amount);

const getCategoryMap = (categories: BillCategory[] = []) =>
    categories.reduce(
        (acc, cur) => {
            acc[cur.id] = cur.name;
            return acc;
        },
        {} as Record<string, string>,
    );

const getTagMap = (tags: BillTag[] = []) =>
    tags.reduce(
        (acc, cur) => {
            acc[cur.id] = cur.name;
            return acc;
        },
        {} as Record<string, string>,
    );

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

    const { bills, statistics } = queryBills(filters, data);
    const allCategories = [...BillCategories, ...(data.meta.categories ?? [])];
    const categoryNameMap = getCategoryMap(allCategories);
    const tagNameMap = getTagMap(data.meta.tags);

    const groups: Record<string, { amount: number; count: number }> = {};
    const trendMap: Record<string, number> = {};

    bills.forEach((bill) => {
        const amount = toUnitAmount(bill.amount);
        let key = "Unknown";

        if (groupBy === "category") {
            key = categoryNameMap[bill.categoryId] || "Unknown Category";
        } else if (groupBy === "tag") {
            if (!bill.tagIds?.length) {
                key = "No Tag";
                if (!groups[key]) groups[key] = { amount: 0, count: 0 };
                groups[key].amount += amount;
                groups[key].count += 1;
            } else {
                bill.tagIds.forEach((tagId) => {
                    const tagName = tagNameMap[tagId] || "Unknown Tag";
                    if (!groups[tagName]) {
                        groups[tagName] = { amount: 0, count: 0 };
                    }
                    groups[tagName].amount += amount;
                    groups[tagName].count += 1;
                });
                key = "";
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

        if (key) {
            if (!groups[key]) groups[key] = { amount: 0, count: 0 };
            groups[key].amount += amount;
            groups[key].count += 1;
        }

        if (includeTrend) {
            const trendKey = dayjs(bill.time).format("YYYY-MM-DD");
            trendMap[trendKey] = (trendMap[trendKey] || 0) + amount;
        }
    });

    const sortedGroups = Object.entries(groups)
        .map(([name, stat]) => ({ name, ...stat }))
        .sort((a, b) => b.amount - a.amount);
    const topN = sortedGroups.slice(0, limit);
    const others = sortedGroups.slice(limit);

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

    const totalCalculatedAmount = topN.reduce(
        (sum, item) => sum + item.amount,
        0,
    );
    const finalDistribution = topN.map((item) => ({
        ...item,
        amount: Number(item.amount.toFixed(2)),
        percentage:
            totalCalculatedAmount === 0
                ? "0%"
                : `${((item.amount / totalCalculatedAmount) * 100).toFixed(1)}%`,
    }));

    const trend = includeTrend
        ? Object.entries(trendMap)
              .map(([date, amount]) => ({
                  date,
                  amount: Number(amount.toFixed(2)),
              }))
              .sort((a, b) => dayjs(a.date).valueOf() - dayjs(b.date).valueOf())
        : undefined;

    return {
        meta: {
            totalAmount: Number(
                toUnitAmount(
                    filters.billType === "income"
                        ? statistics.totalIncome
                        : filters.billType === "expense"
                          ? statistics.totalExpense
                          : statistics.totalIncome - statistics.totalExpense,
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
        trend,
    };
}
