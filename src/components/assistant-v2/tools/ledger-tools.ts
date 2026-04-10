import { z } from "zod";
import { createTool } from "@/assistant";
import type { ExportedJSON } from "@/ledger/type";
import { useLedgerStore } from "@/store/ledger";
import { analyzeBills, getAccountMeta, queryBills } from "./ledger-functions";

const queryLikeSchema = z.object({
    startTime: z.string().optional().describe("Start date, YYYY-MM-DD"),
    endTime: z.string().optional().describe("End date, YYYY-MM-DD"),
    categoryNames: z
        .array(z.string())
        .optional()
        .describe("Category names for fuzzy matching"),
    tagNames: z.array(z.string()).optional().describe("Exact tag names"),
    keyword: z.string().optional().describe("Keyword in bill comment"),
    minAmount: z.number().optional().describe("Min amount in unit currency"),
    maxAmount: z.number().optional().describe("Max amount in unit currency"),
    billType: z
        .enum(["income", "expense"])
        .optional()
        .describe("Filter by income or expense"),
});

async function loadLedgerData(): Promise<ExportedJSON> {
    const store = useLedgerStore.getState();
    const bills = await store.refreshBillList();
    const meta = store.infos?.meta;
    if (!meta) {
        throw new Error("Ledger meta not found");
    }
    return { items: bills, meta };
}

export const QueryBillsTool = createTool({
    name: "query_bills",
    describe:
        "Query raw bill records by time/category/tag/keyword/amount filters. Use for specific transactions.",
    argSchema: queryLikeSchema,
    returnSchema: z.object({
        bills: z.array(z.record(z.string(), z.unknown())),
        statistics: z.object({
            total: z.number(),
            totalIncome: z.number(),
            totalExpense: z.number(),
            netAmount: z.number(),
        }),
    }),
    handler: async (arg) => {
        const data = await loadLedgerData();
        const result = queryBills(arg, data);
        return {
            bills: result.bills.map((bill) => ({
                ...bill,
                amount: bill.amount / 10000,
            })),
            statistics: {
                ...result.statistics,
                totalIncome: result.statistics.totalIncome / 10000,
                totalExpense: result.statistics.totalExpense / 10000,
                netAmount: result.statistics.netAmount / 10000,
            },
        };
    },
});

export const AnalyzeBillsTool = createTool({
    name: "analyze_bills",
    describe:
        "Analyze bills with grouped statistics and optional trend. Prefer this for totals, proportions and trends.",
    argSchema: queryLikeSchema.extend({
        groupBy: z
            .enum(["category", "tag", "day", "month", "year", "type"])
            .optional()
            .describe("Grouping dimension"),
        limit: z.number().int().positive().optional().describe("Top N items"),
        includeTrend: z
            .boolean()
            .optional()
            .describe("Whether to return trend by day"),
    }),
    returnSchema: z.object({
        meta: z.object({
            totalAmount: z.number(),
            count: z.number(),
            currency: z.string(),
            dateRange: z.string(),
        }),
        distribution: z.array(
            z.object({
                name: z.string(),
                amount: z.number(),
                percentage: z.string(),
                count: z.number(),
            }),
        ),
        trend: z
            .array(
                z.object({
                    date: z.string(),
                    amount: z.number(),
                }),
            )
            .optional(),
    }),
    handler: async (arg) => {
        const data = await loadLedgerData();
        return analyzeBills(arg, data);
    },
});

export const GetAccountMetaTool = createTool({
    name: "get_account_meta",
    describe: "Get account metadata including categories, tags and currencies.",
    argSchema: z.object({}),
    returnSchema: z.object({
        categories: z.object({
            all: z.array(z.record(z.string(), z.unknown())),
            tree: z.record(
                z.string(),
                z.array(z.record(z.string(), z.unknown())),
            ),
            roots: z.array(z.record(z.string(), z.unknown())),
        }),
        tags: z.array(z.record(z.string(), z.unknown())),
        currencies: z.array(z.any().describe("Custom Currency object")),
    }),
    handler: async () => {
        const data = await loadLedgerData();
        return getAccountMeta(data.meta);
    },
});
