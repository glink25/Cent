import type { Bill } from "@/ledger/type";

export type DataFilter = {
    start?: number;
    end?: number;
    type?: "income" | "expense";
    categoryIds?: string[];
    tagIds?: string[];
    excludeTagIds?: string[];
    keyword?: string;
    minAmount?: number;
    maxAmount?: number;
};
export function selectBills(bills: Bill[], filter: DataFilter): Bill[] {
    return bills
        .filter(
            (bill) =>
                (filter.start === undefined || bill.time >= filter.start) &&
                (filter.end === undefined || bill.time < filter.end) &&
                (!filter.type || bill.type === filter.type) &&
                (filter.categoryIds === undefined ||
                    filter.categoryIds.includes(bill.categoryId)) &&
                (filter.tagIds === undefined ||
                    filter.tagIds.some((id) => bill.tagIds?.includes(id))) &&
                !filter.excludeTagIds?.some((id) =>
                    bill.tagIds?.includes(id),
                ) &&
                (!filter.keyword ||
                    bill.comment
                        ?.toLocaleLowerCase()
                        .includes(filter.keyword.toLocaleLowerCase())) &&
                (filter.minAmount === undefined ||
                    bill.amount >= filter.minAmount) &&
                (filter.maxAmount === undefined ||
                    bill.amount <= filter.maxAmount),
        )
        .sort((a, b) => a.time - b.time || a.id.localeCompare(b.id));
}
export function summarizeBills(bills: Bill[]) {
    let income = 0;
    let expense = 0;
    for (const bill of bills) {
        if (!Number.isSafeInteger(bill.amount))
            throw new Error("Invalid integer bill amount");
        if (bill.type === "income") income += bill.amount;
        else expense += bill.amount;
    }
    if (!Number.isSafeInteger(income) || !Number.isSafeInteger(expense))
        throw new Error("Amount exceeds safe integer range");
    return { count: bills.length, income, expense, net: income - expense };
}
export function aggregateBills(
    bills: Bill[],
    groupBy: "month" | "category" | "type",
    timeZone: string,
) {
    const formatter = new Intl.DateTimeFormat("en", {
        timeZone,
        year: "numeric",
        month: "2-digit",
    });
    const groups = new Map<string, Bill[]>();
    for (const bill of bills) {
        const parts = formatter.formatToParts(bill.time);
        const key =
            groupBy === "month"
                ? `${parts.find((p) => p.type === "year")?.value}-${parts.find((p) => p.type === "month")?.value}`
                : groupBy === "category"
                  ? bill.categoryId
                  : bill.type;
        const rows = groups.get(key) ?? [];
        rows.push(bill);
        groups.set(key, rows);
    }
    return [...groups]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, rows]) => ({ key, ...summarizeBills(rows) }));
}
