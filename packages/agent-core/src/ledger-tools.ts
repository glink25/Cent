import { z } from "zod";

const filterSchema = z.object({
    start: z.number().optional().describe("Inclusive epoch milliseconds"),
    end: z.number().optional().describe("Exclusive epoch milliseconds"),
    type: z.enum(["income", "expense"]).optional(),
    creatorIds: z.array(z.string().min(1)).optional(),
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
export const defaultFields = [
    "id",
    "time",
    "type",
    "amount",
    "categoryId",
    "tagIds",
    "comment",
    "currency",
    "extra",
    "creatorId",
] as const;
const billFields = [
    ...defaultFields,
    "location",
    "scheduledId",
    "widgetId",
    "attachments",
] as const;

export const LEDGER_AMOUNT_SCALE = 10000;

const integerStats = {
    count: z.number().int().nonnegative(),
    income: z.number().int(),
    expense: z.number().int(),
    net: z.number().int(),
};
const statistics = z.object(integerStats);
const rows = z.array(z.record(z.string(), z.unknown()));
const currencyResult = {
    bookId: z.string(),
    amountScale: z.literal(LEDGER_AMOUNT_SCALE),
    statistics,
};

const exposure = { code: true, native: true };
export const ledgerToolContracts = {
    query: {
        name: "query",
        exposure,
        describe:
            "Read bills. Amounts are integers in 1/10000 base-currency units. Time interval is [start,end). Stable ascending time/id order. Statistics cover ALL matches. offset/limit page only items. Read all pages before custom analysis; use aggregate for complete totals.",
        argSchema: z.object({
            filter: filterSchema.optional(),
            offset: z.number().int().nonnegative().default(0),
            limit: z.number().int().min(1).max(1000).default(100),
            cursor: z.string().optional(),
            fields: z.array(z.enum(billFields)).optional(),
        }),
        returnSchema: z.looseObject({
            ...currencyResult,
            items: rows,
            matchedCount: z.number().int(),
            returnedCount: z.number().int(),
            hasMore: z.boolean(),
            nextCursor: z.string().nullish(),
        }),
    },
    aggregate: {
        name: "aggregate",
        exposure,
        describe:
            "Aggregate ALL matching bills in base currency, integer units 10000:1. Group by month/category/type/creator; specify IANA timeZone for monthly buckets. opaque tags do not change totals. No top-N truncation.",
        argSchema: z.object({
            filter: filterSchema.optional(),
            groupBy: z
                .enum(["month", "category", "type", "creator"])
                .default("month"),
            timeZone: z.string().optional(),
        }),
        returnSchema: z.looseObject({
            ...currencyResult,
            groups: z.array(
                z.looseObject({ key: z.string().nullable(), ...integerStats }),
            ),
        }),
    },
    metadata: {
        name: "metadata",
        exposure,
        describe:
            "Read the current viewer and ledger members, plus effective categories, tags, currencies and computed metadata. Entries with widgetId are computed and read-only.",
        argSchema: z.object({}),
        returnSchema: z.looseObject({
            bookId: z.string(),
            amountScale: z.literal(LEDGER_AMOUNT_SCALE),
            viewerId: z.string().nullable(),
            members: rows,
        }),
    },
    listLedgerObjects: {
        name: "listLedgerObjects",
        exposure,
        describe:
            "Read budgets, your scheduled bills, saved filters, and visible widget configuration.",
        argSchema: z.object({
            kind: z.enum(["budgets", "scheduleds", "savedFilters", "widgets"]),
            id: z.string().optional(),
            limit: z.number().int().min(1).max(1000).default(100),
            cursor: z.string().optional(),
        }),
        returnSchema: z.looseObject({
            items: rows,
            matchedCount: z.number().int(),
            nextCursor: z.string().nullish(),
        }),
    },
    readBillAttachment: {
        name: "readBillAttachment",
        exposure: { native: true, code: false },
        describe:
            "Read one image attachment by bill ID and attachment ID from query.",
        argSchema: z.object({
            billId: z.string(),
            attachmentId: z.string().regex(/^(0|[1-9][0-9]*)$/),
        }),
        returnSchema: z.looseObject({ mimeType: z.string(), data: z.string() }),
    },
} as const;

export const ledgerToolDefinitions = Object.values(ledgerToolContracts).map(
    (tool) => ({
        name: tool.name,
        describe: tool.describe,
        exposure: tool.exposure,
        effect: "read",
        argJsonSchema: z.toJSONSchema(tool.argSchema, { io: "input" }),
        returnJsonSchema: z.toJSONSchema(tool.returnSchema),
    }),
);
