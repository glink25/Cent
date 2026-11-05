import { z } from "zod";
import { createTool, type Tool, type ToolContext } from "@/assistant";
import type { Bill, GlobalMeta } from "@/ledger/type";
import { aggregateBills, selectBills, summarizeBills } from "./data";

export type AgentSnapshot = {
    bookId: string;
    bills: Bill[];
    meta: GlobalMeta;
    timeZone: string;
};
export type AgentDataHost = { snapshot(): Promise<AgentSnapshot> };
const filterSchema = z.object({
    start: z.number().optional().describe("Inclusive epoch milliseconds"),
    end: z.number().optional().describe("Exclusive epoch milliseconds"),
    type: z.enum(["income", "expense"]).optional(),
    categoryIds: z
        .array(z.string())
        .optional()
        .describe("Exact IDs; empty array matches nothing"),
    tagIds: z.array(z.string()).optional(),
    excludeTagIds: z.array(z.string()).optional(),
    keyword: z.string().optional(),
    minAmount: z.number().int().optional(),
    maxAmount: z.number().int().optional(),
});
export function createDataOperations(host: AgentDataHost): Tool[] {
    const snapshotFor = (ctx: ToolContext): Promise<AgentSnapshot> => {
        const key = "cent:read-snapshot";
        const existing = ctx.resources?.get(key) as
            | Promise<AgentSnapshot>
            | undefined;
        if (existing) return existing;
        const pending = host.snapshot();
        ctx.resources?.set(key, pending);
        return pending;
    };
    const exposure = { code: true, native: false };
    return [
        createTool({
            name: "query",
            exposure,
            describe:
                "Read bills. Amounts are integers in 1/10000 base-currency units. Time interval is [start,end). Stable ascending time/id order. Statistics cover ALL matches. offset/limit page only items. Read all pages before custom analysis; use aggregate for complete totals.",
            argSchema: z.object({
                filter: filterSchema.optional(),
                offset: z.number().int().nonnegative().default(0),
                limit: z.number().int().min(1).max(1000).default(100),
                fields: z
                    .array(
                        z.enum([
                            "id",
                            "time",
                            "type",
                            "amount",
                            "categoryId",
                            "tagIds",
                            "comment",
                            "currency",
                            "extra",
                        ]),
                    )
                    .optional(),
            }),
            returnSchema: z.unknown(),
            handler: async ({ filter, offset, limit, fields }, ctx) => {
                const snapshot = await snapshotFor(ctx);
                ctx.signal?.throwIfAborted();
                const rows = selectBills(snapshot.bills, filter ?? {});
                const page = rows.slice(offset, offset + limit);
                return {
                    bookId: snapshot.bookId,
                    amountScale: 10000,
                    currency: snapshot.meta.baseCurrency ?? "CNY",
                    matchedCount: rows.length,
                    returnedCount: page.length,
                    hasMore: offset + limit < rows.length,
                    nextOffset:
                        offset + limit < rows.length ? offset + limit : null,
                    statistics: summarizeBills(rows),
                    items: page.map((b) =>
                        Object.fromEntries(
                            (
                                fields ?? [
                                    "id",
                                    "time",
                                    "type",
                                    "amount",
                                    "categoryId",
                                    "tagIds",
                                    "comment",
                                    "currency",
                                    "extra",
                                ]
                            ).map((key) => [key, b[key]]),
                        ),
                    ),
                };
            },
        }),
        createTool({
            name: "aggregate",
            exposure,
            describe:
                "Aggregate ALL matching bills in base currency, integer units 10000:1. Group by month/category/type; specify IANA timeZone for monthly buckets. opaque tags do not change totals. No top-N truncation.",
            argSchema: z.object({
                filter: filterSchema.optional(),
                groupBy: z.enum(["month", "category", "type"]).default("month"),
                timeZone: z.string().optional(),
            }),
            returnSchema: z.unknown(),
            handler: async ({ filter, groupBy, timeZone }, ctx) => {
                const snapshot = await snapshotFor(ctx);
                ctx.signal?.throwIfAborted();
                const rows = selectBills(snapshot.bills, filter ?? {});
                return {
                    bookId: snapshot.bookId,
                    amountScale: 10000,
                    currency: snapshot.meta.baseCurrency ?? "CNY",
                    timeZone: timeZone ?? snapshot.timeZone,
                    statistics: summarizeBills(rows),
                    groups: aggregateBills(
                        rows,
                        groupBy,
                        timeZone ?? snapshot.timeZone,
                    ),
                };
            },
        }),
        createTool({
            name: "metadata",
            exposure,
            describe:
                "Read effective categories/tags/currencies and widget-generated metadata. Entries with widgetId are computed and read-only.",
            argSchema: z.object({}),
            returnSchema: z.unknown(),
            handler: async (_, ctx) => {
                const snapshot = await snapshotFor(ctx);
                ctx.signal?.throwIfAborted();
                const {
                    categories,
                    tags,
                    customCurrencies,
                    customFilters,
                    baseCurrency,
                } = snapshot.meta;
                return {
                    bookId: snapshot.bookId,
                    amountScale: 10000,
                    baseCurrency,
                    categories,
                    tags,
                    customCurrencies,
                    customFilters,
                };
            },
        }),
    ] as Tool[];
}
