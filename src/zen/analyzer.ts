import dayjs from "dayjs";
import { amountToNumber } from "@/ledger/bill";
import { ExpenseBillCategories, IncomeBillCategories } from "@/ledger/category";
import type { Bill, GlobalMeta } from "@/ledger/type";
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

function categoryNameById(meta: GlobalMeta | undefined) {
    const categories = [
        ...ExpenseBillCategories,
        ...IncomeBillCategories,
        ...(meta?.categories ?? []),
    ];
    const map = new Map(categories.map((category) => [category.id, category]));
    return (id: string) => map.get(id)?.name ?? id;
}

function trimComment(comment: string | undefined) {
    if (!comment) return undefined;
    return comment.length > 40 ? `${comment.slice(0, 40)}...` : comment;
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
    const getCategoryName = categoryNameById(meta);
    const periodBills = bills.filter(
        (bill) => bill.time >= period.start && bill.time <= period.end,
    );

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

    const candidateBills = [...periodBills]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 8)
        .map((bill) => ({
            id: bill.id,
            type: bill.type,
            categoryId: bill.categoryId,
            categoryName: getCategoryName(bill.categoryId),
            amount: amountToNumber(bill.amount),
            time: bill.time,
            comment: trimComment(bill.comment),
        }));

    const signals: ZenSignal[] = [];
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
        signals,
        candidateBills,
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
