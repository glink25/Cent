import { z } from "zod";
import { createTool } from "@/assistant";
import type { ExportedJSON } from "@/ledger/type";
import { useLedgerStore } from "@/store/ledger";
import { analyzeBills, getAccountMeta, queryBills } from "./ledger-functions";

const queryLikeSchema = z.object({
    startTime: z.string().optional().describe("YYYY-MM-DD"),
    endTime: z.string().optional().describe("YYYY-MM-DD"),
    categoryNames: z
        .array(z.string())
        .optional()
        .describe("分类名（逗号分隔，支持模糊匹配）"),
    tagNames: z.array(z.string()).optional().describe("标签名（逗号分隔）"),
    keyword: z.string().optional().describe("备注关键词"),
    minAmount: z.number().optional().describe("金额范围（数字）"),
    maxAmount: z.number().optional().describe("金额范围（数字）"),
    billType: z
        .enum(["income", "expense"])
        .optional()
        .describe("income 或 expense"),
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
    name: "queryBills",
    describe:
        "查询原始账单明细。用于按时间/分类/标签/关键字/金额筛选具体账单。注意如果没有设置合理筛选条件，该工具有可能返回大量账单数据，因此必须谨慎使用，适用场景：查找单笔交易时，或者有明确的时间范围。",
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
    name: "analyzeBills",
    describe: "账单统计与分析。优先用于总额、占比、趋势和概况分析。",
    argSchema: queryLikeSchema.extend({
        groupBy: z
            .enum(["category", "tag", "day", "month", "year", "type"])
            .optional()
            .describe(
                "分组维度，可选值：category/tag/day/month/year/type（category: 按分类统计，tag: 按标签统计，day: 按日统计，month: 按月统计）",
            ),
        limit: z
            .number()
            .int()
            .positive()
            .optional()
            .describe("返回前几项（数字，默认10）"),
        includeTrend: z
            .boolean()
            .optional()
            .describe("true 或 false (是否包含时间趋势数据，用于分析波动)"),
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
    name: "getAccountMeta",
    describe: "获取账本信息，用于获取当前账本定义的分类结构和标签列表。",
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
