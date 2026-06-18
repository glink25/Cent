import dayjs from "dayjs";
import {
    budgetEncountered,
    budgetRange,
    budgetTotal,
} from "@/components/budget/util";
import { amountToNumber } from "@/ledger/bill";
import { BillCategories } from "@/ledger/category";
import type { Bill, GlobalMeta } from "@/ledger/type";
import { intlCategory } from "@/ledger/utils";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import {
    getCalendarPosition,
    getDefaultZenPeriod,
    getSuggestedZenPeriods,
} from "./date";
import type {
    ZenContext,
    ZenDayId,
    ZenFocusDecision,
    ZenPeriod,
    ZenPost,
    ZenSignal,
} from "./types";

type ZenPeriodAnalysis = Omit<
    ZenContext,
    | "zenDayId"
    | "now"
    | "focusDecision"
    | "recentZenPosts"
    | "calendarPosition"
    | "suggestedPeriods"
    | "lastZenPost"
>;

function categoryNameById() {
    const categories = getAllCategories();
    const map = new Map(categories.map((category) => [category.id, category]));
    return (id: string) => map.get(id)?.name ?? id;
}

const getAllCategories = () => {
    const savedCategories = useLedgerStore.getState().infos?.meta.categories;

    const categories = (savedCategories ?? BillCategories).map((v) => {
        const cate = intlCategory(v, t);
        return cate;
    });
    return categories;
};

function trimComment(comment: string | undefined) {
    if (!comment) return undefined;
    return comment.length > 40 ? `${comment.slice(0, 40)}...` : comment;
}

function includesAnyKeyword(value: string | undefined, keywords: string[]) {
    if (!value) return false;
    const lower = value.toLowerCase();
    return keywords.some((keyword) => lower.includes(keyword.toLowerCase()));
}

function isProbablySubscription(bill: Bill, categoryName: string) {
    return includesAnyKeyword(`${categoryName} ${bill.comment ?? ""}`, [
        "订阅",
        "会员",
        "自动续费",
        "月费",
        "年费",
        "subscription",
        "membership",
        "premium",
        "netflix",
        "spotify",
        "icloud",
    ]);
}

function signalDeviation(ratio: number): ZenSignal["deviationLevel"] {
    if (ratio >= 1.2) return "extreme";
    if (ratio >= 1) return "high";
    if (ratio >= 0.8) return "medium";
    if (ratio >= 0.6) return "mild";
    return "normal";
}

function buildCandidateGroup({
    id,
    label,
    reason,
    bills,
    categoryName,
    signalType,
}: {
    id: string;
    label: string;
    reason: string;
    bills: Bill[];
    categoryName?: string;
    signalType?: ZenSignal["type"];
}): ZenContext["candidateGroups"][number] | undefined {
    if (bills.length === 0) return undefined;
    return {
        id,
        label,
        reason,
        billIds: bills.map((bill) => bill.id).slice(0, 8),
        totalAmount: bills.reduce(
            (total, bill) => total + amountToNumber(bill.amount),
            0,
        ),
        categoryName,
        signalType,
    };
}

export function analyzeZenPeriod({
    bills,
    meta,
    period,
}: {
    bills: Bill[];
    meta?: GlobalMeta;
    period: ZenPeriod;
}): ZenPeriodAnalysis {
    const getCategoryName = categoryNameById();
    const allCategories = getAllCategories();
    const periodBills = bills.filter(
        (bill) => bill.time >= period.start && bill.time <= period.end,
    );
    const periodExpenseBills = periodBills.filter(
        (bill) => bill.type === "expense",
    );
    const habitPatterns: ZenContext["habitPatterns"] = [];

    const weekendBills = periodExpenseBills.filter((bill) => {
        const day = dayjs(bill.time).day();
        return day === 0 || day === 6;
    });
    if (
        periodExpenseBills.length >= 4 &&
        weekendBills.length / periodExpenseBills.length >= 0.6
    ) {
        habitPatterns.push({
            id: "weekend-concentration",
            label: "支出更多发生在周末",
            evidence: `${weekendBills.length}/${periodExpenseBills.length} 笔支出发生在周末。`,
            billIds: weekendBills.slice(0, 8).map((bill) => bill.id),
        });
    }

    const timeBuckets = [
        { id: "morning", label: "上午", start: 5, end: 11 },
        { id: "afternoon", label: "下午", start: 11, end: 17 },
        { id: "evening", label: "晚上", start: 17, end: 23 },
        { id: "late-night", label: "深夜", start: 23, end: 29 },
    ].map((bucket) => {
        const matched = periodExpenseBills.filter((bill) => {
            const hour = dayjs(bill.time).hour();
            const normalizedHour = hour < 5 ? hour + 24 : hour;
            return (
                normalizedHour >= bucket.start && normalizedHour < bucket.end
            );
        });
        return { ...bucket, bills: matched };
    });
    const dominantTime = timeBuckets.sort(
        (a, b) => b.bills.length - a.bills.length,
    )[0];
    if (
        dominantTime &&
        dominantTime.bills.length >= 3 &&
        dominantTime.bills.length / periodExpenseBills.length >= 0.5
    ) {
        habitPatterns.push({
            id: `time-${dominantTime.id}`,
            label: `支出集中在${dominantTime.label}`,
            evidence: `${dominantTime.bills.length}/${periodExpenseBills.length} 笔支出发生在${dominantTime.label}。`,
            billIds: dominantTime.bills.slice(0, 8).map((bill) => bill.id),
        });
    }

    const comments = new Map<string, Bill[]>();
    for (const bill of periodExpenseBills) {
        const comment = bill.comment?.trim().toLowerCase();
        if (!comment || comment.length < 2) continue;
        comments.set(comment, [...(comments.get(comment) ?? []), bill]);
    }
    const repeatedComment = [...comments.entries()].sort(
        (a, b) => b[1].length - a[1].length,
    )[0];
    if (repeatedComment && repeatedComment[1].length >= 2) {
        habitPatterns.push({
            id: "repeated-comment",
            label: "相似的消费场景反复出现",
            evidence: `“${trimComment(repeatedComment[0])}”出现了 ${repeatedComment[1].length} 次。`,
            billIds: repeatedComment[1].slice(0, 8).map((bill) => bill.id),
        });
    }

    let expenseTotal = 0;
    let incomeTotal = 0;
    const categoryMap = new Map<
        string,
        {
            id: string;
            name: string;
            amount: number;
            count: number;
            type: "income" | "expense";
            billIds: string[];
        }
    >();

    for (const bill of periodBills) {
        const amount = amountToNumber(bill.amount);
        if (bill.type === "income") {
            incomeTotal += amount;
        } else {
            expenseTotal += amount;
        }

        const prev = categoryMap.get(bill.categoryId) ?? {
            id: bill.categoryId,
            name: getCategoryName(bill.categoryId),
            amount: 0,
            count: 0,
            type: bill.type,
            billIds: [],
        };
        prev.amount += amount;
        prev.count += 1;
        prev.billIds.push(bill.id);
        categoryMap.set(bill.categoryId, prev);
    }

    const topCategories = [...categoryMap.values()]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 5)
        .map(({ billIds: _billIds, ...category }) => category);

    const summarizeBill = (bill: Bill) => ({
        id: bill.id,
        type: bill.type,
        categoryId: bill.categoryId,
        categoryName: getCategoryName(bill.categoryId),
        amount: amountToNumber(bill.amount),
        time: bill.time,
        comment: trimComment(bill.comment),
    });

    const topCandidateBills = [...periodBills]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8)
        .map(summarizeBill);

    const signals: ZenSignal[] = [];
    const candidateGroups: ZenContext["candidateGroups"] = [];
    const topExpenseCategory = [...categoryMap.values()]
        .filter((category) => category.type === "expense")
        .sort((a, b) => b.count - a.count)[0];
    if (topExpenseCategory && topExpenseCategory.count >= 3) {
        signals.push({
            type: "high_frequency_micro_spending",
            categoryId: topExpenseCategory.id,
            categoryName: topExpenseCategory.name,
            count: topExpenseCategory.count,
            amount: topExpenseCategory.amount,
            billIds: topExpenseCategory.billIds.slice(0, 5),
            deviationLevel: topExpenseCategory.count >= 6 ? "high" : "medium",
        });
        const group = buildCandidateGroup({
            id: `category-${topExpenseCategory.id}`,
            label: topExpenseCategory.name,
            reason: "这类支出在本次周期里出现得比较频繁。",
            bills: periodBills.filter(
                (bill) => bill.categoryId === topExpenseCategory.id,
            ),
            categoryName: topExpenseCategory.name,
            signalType: "high_frequency_micro_spending",
        });
        if (group) candidateGroups.push(group);
    }

    const largestExpense = periodBills
        .filter((bill) => bill.type === "expense")
        .sort((a, b) => b.amount - a.amount)[0];
    if (
        largestExpense &&
        expenseTotal > 0 &&
        amountToNumber(largestExpense.amount) / expenseTotal >= 0.6
    ) {
        signals.push({
            type: "large_unusual_expense",
            categoryId: largestExpense.categoryId,
            categoryName: getCategoryName(largestExpense.categoryId),
            amount: amountToNumber(largestExpense.amount),
            billIds: [largestExpense.id],
            deviationLevel: "high",
        });
        const group = buildCandidateGroup({
            id: `large-${largestExpense.id}`,
            label: getCategoryName(largestExpense.categoryId),
            reason: "这笔支出占本周期支出的比例较高。",
            bills: [largestExpense],
            categoryName: getCategoryName(largestExpense.categoryId),
            signalType: "large_unusual_expense",
        });
        if (group) candidateGroups.push(group);
    }

    const subscriptionBills = periodExpenseBills.filter((bill) =>
        isProbablySubscription(bill, getCategoryName(bill.categoryId)),
    );
    if (subscriptionBills.length > 0) {
        signals.push({
            type: "subscription_leak",
            count: subscriptionBills.length,
            amount: subscriptionBills.reduce(
                (total, bill) => total + amountToNumber(bill.amount),
                0,
            ),
            billIds: subscriptionBills.map((bill) => bill.id).slice(0, 5),
            deviationLevel: subscriptionBills.length >= 3 ? "medium" : "mild",
        });
        const group = buildCandidateGroup({
            id: "subscription-leak",
            label: "订阅与自动续费",
            reason: "这些支出看起来像订阅、会员或周期性扣费。",
            bills: subscriptionBills,
            signalType: "subscription_leak",
        });
        if (group) candidateGroups.push(group);
    }

    const keywordSignals: {
        type: ZenSignal["type"];
        id: string;
        label: string;
        reason: string;
        keywords: string[];
    }[] = [
        {
            type: "social_spending",
            id: "social-spending",
            label: "人际关系里的支出",
            reason: "备注或分类里出现了聚会、礼物、请客等社交线索。",
            keywords: [
                "聚会",
                "礼物",
                "请客",
                "朋友",
                "家庭",
                "社交",
                "gift",
                "party",
            ],
        },
        {
            type: "self_improvement_spending",
            id: "self-improvement",
            label: "为未来的自己花钱",
            reason: "这些支出可能与学习、健康或长期成长有关。",
            keywords: [
                "课程",
                "学习",
                "书",
                "健身",
                "培训",
                "教育",
                "course",
                "book",
                "gym",
            ],
        },
        {
            type: "time_saving_spending",
            id: "time-saving",
            label: "用钱购买时间",
            reason: "这些支出可能是在替你节省时间或精力。",
            keywords: [
                "外卖",
                "打车",
                "快递",
                "配送",
                "代办",
                "taxi",
                "uber",
                "delivery",
            ],
        },
        {
            type: "emotional_spending",
            id: "emotional-spending",
            label: "情绪的缓冲垫",
            reason: "备注或分类里出现了安慰、奖励、疲惫后的补偿线索。",
            keywords: [
                "奶茶",
                "咖啡",
                "甜品",
                "奖励",
                "安慰",
                "放松",
                "coffee",
                "dessert",
            ],
        },
        {
            type: "planned_purchase",
            id: "planned-purchase",
            label: "计划内消费",
            reason: "备注里出现了计划、预算或预订等线索。",
            keywords: [
                "计划",
                "预算",
                "预订",
                "预约",
                "planned",
                "budget",
                "booking",
            ],
        },
        {
            type: "unplanned_purchase",
            id: "unplanned-purchase",
            label: "计划外支出",
            reason: "备注里出现了临时、补买、应急等线索。",
            keywords: [
                "临时",
                "突然",
                "应急",
                "补买",
                "忘记",
                "unplanned",
                "urgent",
            ],
        },
    ];

    for (const item of keywordSignals) {
        const matched = periodExpenseBills.filter((bill) =>
            includesAnyKeyword(
                `${getCategoryName(bill.categoryId)} ${bill.comment ?? ""}`,
                item.keywords,
            ),
        );
        if (matched.length === 0) continue;
        signals.push({
            type: item.type,
            count: matched.length,
            amount: matched.reduce(
                (total, bill) => total + amountToNumber(bill.amount),
                0,
            ),
            billIds: matched.map((bill) => bill.id).slice(0, 5),
            deviationLevel: matched.length >= 3 ? "medium" : "mild",
        });
        const group = buildCandidateGroup({
            id: item.id,
            label: item.label,
            reason: item.reason,
            bills: matched,
            signalType: item.type,
        });
        if (group) candidateGroups.push(group);
    }

    const periodLength = period.end - period.start;
    const previousPeriod = {
        ...period,
        start: period.start - periodLength - 1,
        end: period.start - 1,
    };
    const previousTopById = new Map<
        string,
        { id: string; name: string; amount: number }
    >();
    for (const bill of bills.filter(
        (item) =>
            item.type === "expense" &&
            item.time >= previousPeriod.start &&
            item.time <= previousPeriod.end,
    )) {
        const prev = previousTopById.get(bill.categoryId) ?? {
            id: bill.categoryId,
            name: getCategoryName(bill.categoryId),
            amount: 0,
        };
        prev.amount += amountToNumber(bill.amount);
        previousTopById.set(bill.categoryId, prev);
    }
    for (const category of topCategories.filter(
        (item) => item.type === "expense",
    )) {
        const previous = previousTopById.get(category.id);
        if (
            previous &&
            previous.amount >= category.amount * 2 &&
            previous.amount - category.amount >= 10
        ) {
            signals.push({
                type: "category_drop",
                categoryId: category.id,
                categoryName: category.name,
                amount: previous.amount - category.amount,
                deviationLevel: "medium",
            });
            habitPatterns.push({
                id: `category-drop-${category.id}`,
                label: `${category.name}支出频率或金额正在回落`,
                evidence: `相比上一相同周期，金额减少了 ${Math.round(previous.amount - category.amount)}。`,
                billIds: periodBills
                    .filter((bill) => bill.categoryId === category.id)
                    .slice(0, 8)
                    .map((bill) => bill.id),
            });
            break;
        }
    }

    const budgets = (meta?.budgets ?? []).flatMap((budget) => {
        const [, currentRange] = budgetRange(budget, period.end);
        if (!currentRange) return [];
        const [start, end] = currentRange;
        if (end.valueOf() < period.start || start.valueOf() > period.end) {
            return [];
        }
        const encountered = budgetEncountered(
            budget,
            bills,
            currentRange,
            allCategories,
        );
        const totalBudget = budgetTotal(budget);
        const ratio = totalBudget > 0 ? encountered.totalUsed / totalBudget : 0;
        const categories = budget.categoriesBudget?.map((category) => {
            const used =
                encountered.categoriesUsed?.find(
                    (item) => item.id === category.id,
                )?.used ?? 0;
            const categoryRatio =
                category.budget > 0 ? used / category.budget : 0;
            return {
                id: category.id,
                name: getCategoryName(category.id),
                budget: category.budget,
                used,
                ratio: categoryRatio,
                status:
                    categoryRatio >= 1
                        ? "over_limit"
                        : categoryRatio >= 0.8
                          ? "near_limit"
                          : "normal",
            } as const;
        });
        return [
            {
                id: budget.id,
                title: budget.title,
                periodStart: start.valueOf(),
                periodEnd: end.valueOf(),
                totalBudget,
                totalUsed: encountered.totalUsed,
                ratio,
                status:
                    ratio >= 1
                        ? "over_limit"
                        : ratio >= 0.8
                          ? "near_limit"
                          : "normal",
                categories,
            } as const,
        ];
    });

    for (const budget of budgets) {
        if (budget.status === "normal") continue;
        signals.push({
            type: "category_over_budget",
            amount: budget.totalUsed,
            deviationLevel: signalDeviation(budget.ratio),
        });
        const overCategory = budget.categories?.find(
            (category) => category.status !== "normal",
        );
        if (!overCategory) continue;
        signals.push({
            type: "category_over_budget",
            categoryId: overCategory.id,
            categoryName: overCategory.name,
            amount: overCategory.used,
            deviationLevel: signalDeviation(overCategory.ratio),
        });
    }

    if (incomeTotal > 0) {
        signals.push({
            type: "income_spike",
            amount: incomeTotal,
            billIds: periodBills
                .filter((bill) => bill.type === "income")
                .map((bill) => bill.id)
                .slice(0, 5),
            deviationLevel: "medium",
        });
    }

    if (signals.length === 0) {
        signals.push({
            type: periodBills.length === 0 ? "flat_day" : "healthy_balance",
            deviationLevel: "normal",
        });
    }

    const periodBillMap = new Map(periodBills.map((bill) => [bill.id, bill]));
    const candidateBillIds = new Set([
        ...topCandidateBills.map((bill) => bill.id),
        ...candidateGroups.flatMap((group) => group.billIds),
    ]);
    const candidateBills = [...candidateBillIds]
        .map((id) => periodBillMap.get(id))
        .filter((bill): bill is Bill => Boolean(bill))
        .slice(0, 20)
        .map(summarizeBill);

    return {
        period,
        summary: {
            expenseTotal,
            incomeTotal,
            netAmount: incomeTotal - expenseTotal,
            billCount: periodBills.length,
            currency: meta?.baseCurrency ?? "CNY",
        },
        topCategories,
        budgets,
        signals,
        candidateGroups: candidateGroups.slice(0, 8),
        candidateBills,
        habitPatterns: habitPatterns.slice(0, 6),
    };
}

export function buildZenContext({
    zenDayId,
    bills,
    meta,
    recentZenPosts,
    focusDecision,
    now = dayjs(),
}: {
    zenDayId: ZenDayId;
    bills: Bill[];
    meta?: GlobalMeta;
    recentZenPosts: ZenPost[];
    focusDecision?: ZenFocusDecision;
    now?: dayjs.Dayjs;
}): ZenContext {
    const lastZenPost = recentZenPosts.find((post) => post.id !== zenDayId);
    const suggestedPeriods = getSuggestedZenPeriods({ now, lastZenPost });
    const period =
        focusDecision?.period ??
        suggestedPeriods[0]?.period ??
        getDefaultZenPeriod({ now, lastZenPost });
    return {
        ...analyzeZenPeriod({ bills, meta, period }),
        zenDayId,
        now: now.toISOString(),
        focusDecision,
        recentZenPosts,
        calendarPosition: getCalendarPosition(now),
        suggestedPeriods,
        lastZenPost,
    };
}

export { analyzeZenPeriod as analyzeZenDay };
