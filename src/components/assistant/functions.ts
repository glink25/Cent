import dayjs from "dayjs";
import { numberToAmount } from "@/ledger/bill";
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
