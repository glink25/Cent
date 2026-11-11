import {
    defaultFields,
    LEDGER_AMOUNT_SCALE,
    ledgerToolContracts,
} from "@glink25/agent-core/ledger-tools";
import { createTool, type Tool, type ToolContext } from "@/assistant";
import type { Bill, GlobalMeta } from "@/ledger/type";
import {
    aggregateBills,
    creatorKey,
    selectBills,
    summarizeBills,
} from "./data";

export type AgentSnapshot = {
    bookId: string;
    scope?: number;
    skippedCount?: number;
    syncStatus?: "offline" | "unknown";
    bills: Bill[];
    meta: GlobalMeta;
    timeZone: string;
    viewerId: string | null;
    members: { id: string; displayName: string | null }[];
    effectiveMeta?: () => Promise<GlobalMeta>;
    readAttachment?: (bill: Bill, index: number) => Promise<Blob>;
};
export type AgentDataHost = { snapshot(): Promise<AgentSnapshot> };

const ledgerUnits = { amountScale: LEDGER_AMOUNT_SCALE } as const;

const snapshotKey = "cent:read-snapshot";

export function getAgentTurnSnapshot(resources?: Map<string, unknown>) {
    return resources?.get(snapshotKey) as Promise<AgentSnapshot> | undefined;
}
const ledgerObjectFields = {
    budgets: [
        "id",
        "title",
        "start",
        "end",
        "repeat",
        "joiners",
        "totalBudget",
        "categoriesBudget",
        "onlyTags",
        "excludeTags",
    ],
    scheduleds: [
        "id",
        "title",
        "start",
        "end",
        "repeat",
        "enabled",
        "latest",
        "template",
    ],
    savedFilters: [
        "id",
        "name",
        "filter",
        "displayCurrency",
        "modules",
        "widgetId",
    ],
    widgets: ["id", "name", "permissions", "settings", "computed"],
};
const scheduledTemplateFields = [
    "type",
    "categoryId",
    "amount",
    "time",
    "comment",
    "tagIds",
    "currency",
    "location",
];
const project = (row: object, fields: readonly string[]) =>
    Object.fromEntries(
        Object.entries(row).filter(([key]) => fields.includes(key)),
    );

type Cursor = {
    snapshot: AgentSnapshot;
    offset: number;
    signature: string;
    expires: number;
    signal?: AbortSignal;
};

export function createDataOperations(host: AgentDataHost): Tool[] {
    const snapshotFor = (ctx: ToolContext): Promise<AgentSnapshot> => {
        const existing = getAgentTurnSnapshot(ctx.resources);
        if (existing) return existing;
        const pending = host.snapshot();
        ctx.resources?.set(snapshotKey, pending);
        void pending.catch(() => {
            if (getAgentTurnSnapshot(ctx.resources) === pending)
                ctx.resources?.delete(snapshotKey);
        });
        return pending;
    };
    const cursors = new Map<string, Cursor>();
    const continuation = (
        cursor: string | undefined,
        active: AgentSnapshot,
        signature: string,
        signal?: AbortSignal,
    ) => {
        if (!cursor) return undefined;
        const saved = cursors.get(cursor);
        if (
            !saved ||
            saved.expires <= Date.now() ||
            saved.signal?.aborted ||
            saved.signal !== signal ||
            saved.snapshot.scope !== active.scope ||
            saved.snapshot.bookId !== active.bookId ||
            saved.snapshot.viewerId !== active.viewerId ||
            saved.signature !== signature
        )
            throw new Error("Invalid or expired ledger cursor");
        return saved;
    };
    const nextCursor = (
        snapshot: AgentSnapshot,
        offset: number,
        signature: string,
        signal?: AbortSignal,
    ) => {
        const token = crypto.randomUUID();
        for (const [key, saved] of cursors) {
            if (saved.expires <= Date.now() || saved.signal?.aborted)
                cursors.delete(key);
        }
        const oldest = cursors.keys().next().value;
        if (cursors.size >= 32 && oldest !== undefined) cursors.delete(oldest);
        cursors.set(token, {
            snapshot,
            offset,
            signature,
            expires: Date.now() + 300_000,
            signal,
        });
        return token;
    };
    return [
        createTool({
            ...ledgerToolContracts.query,
            handler: async ({ filter, offset, limit, fields, cursor }, ctx) => {
                const active = await snapshotFor(ctx);
                const signature = JSON.stringify([
                    Object.entries(filter ?? {}).sort(([a], [b]) =>
                        a.localeCompare(b),
                    ),
                    fields ?? defaultFields,
                ]);
                const saved = continuation(
                    cursor,
                    active,
                    signature,
                    ctx.signal,
                );
                const snapshot = saved?.snapshot ?? active;
                offset = saved?.offset ?? offset;
                ctx.signal?.throwIfAborted();
                const rows = selectBills(snapshot.bills, filter ?? {});
                const page = rows.slice(offset, offset + limit);
                return {
                    bookId: snapshot.bookId,
                    ...ledgerUnits,
                    currency: snapshot.meta.baseCurrency ?? "CNY",
                    matchedCount: rows.length,
                    returnedCount: page.length,
                    hasMore: offset + limit < rows.length,
                    nextOffset:
                        offset + limit < rows.length ? offset + limit : null,
                    statistics: summarizeBills(rows),
                    nextCursor:
                        offset + limit < rows.length
                            ? nextCursor(
                                  snapshot,
                                  offset + limit,
                                  signature,
                                  ctx.signal,
                              )
                            : null,
                    skippedCount: snapshot.skippedCount ?? 0,
                    localComplete: true,
                    syncStatus: snapshot.syncStatus ?? "unknown",
                    items: page.map((bill) =>
                        Object.fromEntries(
                            (fields ?? defaultFields).map((key) => {
                                switch (key) {
                                    case "creatorId":
                                        return [
                                            key,
                                            creatorKey(bill.creatorId),
                                        ];
                                    case "scheduledId":
                                        return [key, bill.extra?.scheduledId];
                                    case "widgetId":
                                        return [key, bill.extra?.widgetId];
                                    case "attachments":
                                        return [
                                            key,
                                            bill.images?.map(
                                                (image, index) => ({
                                                    id: String(index),
                                                    ...(typeof image ===
                                                    "string"
                                                        ? {}
                                                        : {
                                                              name: image.name,
                                                              mimeType:
                                                                  image.type,
                                                              size: image.size,
                                                          }),
                                                }),
                                            ) ?? [],
                                        ];
                                    case "extra":
                                        return [
                                            key,
                                            bill.extra && {
                                                scheduledId:
                                                    bill.extra.scheduledId,
                                                widgetId: bill.extra.widgetId,
                                            },
                                        ];
                                    default:
                                        return [key, bill[key]];
                                }
                            }),
                        ),
                    ),
                };
            },
        }),
        createTool({
            ...ledgerToolContracts.aggregate,
            handler: async ({ filter, groupBy, timeZone }, ctx) => {
                const snapshot = await snapshotFor(ctx);
                ctx.signal?.throwIfAborted();
                const rows = selectBills(snapshot.bills, filter ?? {});
                return {
                    bookId: snapshot.bookId,
                    ...ledgerUnits,
                    currency: snapshot.meta.baseCurrency ?? "CNY",
                    skippedCount: snapshot.skippedCount ?? 0,
                    localComplete: true,
                    syncStatus: snapshot.syncStatus ?? "unknown",
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
            ...ledgerToolContracts.metadata,
            handler: async (_, ctx) => {
                const snapshot = await snapshotFor(ctx);
                ctx.signal?.throwIfAborted();
                const {
                    categories,
                    tags,
                    customCurrencies,
                    customFilters,
                    baseCurrency,
                } = await (snapshot.effectiveMeta?.() ?? snapshot.meta);
                return {
                    bookId: snapshot.bookId,
                    ...ledgerUnits,
                    baseCurrency,
                    viewerId: snapshot.viewerId,
                    members: snapshot.members,
                    categories,
                    tags,
                    customCurrencies,
                    customFilters,
                };
            },
        }),
        createTool({
            ...ledgerToolContracts.listLedgerObjects,
            handler: async ({ kind, id, limit, cursor }, ctx) => {
                const active = await snapshotFor(ctx);
                const signature = JSON.stringify([kind, id]);
                const saved = continuation(
                    cursor,
                    active,
                    signature,
                    ctx.signal,
                );
                const snapshot = saved?.snapshot ?? active;
                const offset = saved?.offset ?? 0;
                const meta =
                    kind === "savedFilters" || kind === "widgets"
                        ? await (snapshot.effectiveMeta?.() ?? snapshot.meta)
                        : snapshot.meta;
                const rows = (
                    {
                        budgets: meta.budgets,
                        scheduleds:
                            snapshot.viewerId == null
                                ? []
                                : meta.personal?.[
                                      snapshot.viewerId
                                  ]?.scheduleds?.map((scheduled) => ({
                                      ...scheduled,
                                      template: project(
                                          scheduled.template,
                                          scheduledTemplateFields,
                                      ),
                                  })),
                        savedFilters: meta.customFilters,
                        widgets: meta.widgets?.map(
                            ({ id, name, permissions, settings }) => ({
                                id,
                                name,
                                permissions,
                                settings,
                                computed: Object.fromEntries(
                                    (
                                        [
                                            "categories",
                                            "tags",
                                            "customCurrencies",
                                            "customFilters",
                                        ] as const
                                    ).map((key) => [
                                        key,
                                        (meta[key] ?? []).filter(
                                            (entry) =>
                                                "widgetId" in entry &&
                                                entry.widgetId === id,
                                        ),
                                    ]),
                                ),
                            }),
                        ),
                    }[kind] ?? []
                ).filter((row) => id === undefined || row.id === id);
                const end = offset + limit;
                return {
                    items: rows
                        .slice(offset, end)
                        .map((row) => project(row, ledgerObjectFields[kind])),
                    matchedCount: rows.length,
                    nextCursor:
                        end < rows.length
                            ? nextCursor(snapshot, end, signature, ctx.signal)
                            : null,
                };
            },
        }),
        createTool({
            ...ledgerToolContracts.readBillAttachment,
            handler: async ({ billId, attachmentId }, ctx) => {
                const snapshot = await snapshotFor(ctx);
                const bill = snapshot.bills.find((row) => row.id === billId);
                const index = Number(attachmentId);
                if (!bill?.images?.[index] || !snapshot.readAttachment)
                    throw new Error("Attachment not found");
                const blob = await snapshot.readAttachment(bill, index);
                ctx.signal?.throwIfAborted();
                if (blob.size > 5 * 1024 * 1024)
                    throw new Error("Attachment exceeds 5 MiB");
                const header = new Uint8Array(
                    await blob.slice(0, 12).arrayBuffer(),
                );
                const signature = String.fromCharCode(...header);
                const mimeType = signature.startsWith("\x89PNG")
                    ? "image/png"
                    : signature.startsWith("\xff\xd8\xff")
                      ? "image/jpeg"
                      : signature.startsWith("GIF8")
                        ? "image/gif"
                        : signature.startsWith("RIFF") &&
                            signature.slice(8) === "WEBP"
                          ? "image/webp"
                          : null;
                if (!mimeType) throw new Error("Unsupported attachment format");
                const { blobToBase64 } = await import("@/utils/file");
                return { mimeType, data: await blobToBase64(blob) };
            },
        }),
    ] as Tool[];
}
