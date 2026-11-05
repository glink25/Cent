import { z } from "zod";
import { createTool, type Tool } from "@/assistant";
import compileWidget from "@/components/widget/core/compile";
import { BillCategories } from "@/ledger/category";
import type { Bill, GlobalMeta } from "@/ledger/type";
import { getChangeStatus, proposeChange } from "./changes";
import { widgetOperations } from "./widget-operations";

const native = { native: true, code: false };
const writable = { native: true, code: true };
const id = z.string().min(1);
const repeat = z.object({
    unit: z.enum(["day", "week", "month", "year"]),
    value: z.number().int().positive(),
});
const member = z.union([z.string(), z.number()]);
const billFields = z.object({
    type: z.enum(["income", "expense"]),
    categoryId: id,
    amount: z.number().int().nonnegative(),
    time: z.number().int(),
    comment: z.string().optional(),
    tagIds: z.array(id).optional(),
    images: z
        .array(
            z
                .string()
                .regex(/^(https?:\/\/|data:image\/(jpeg|png|webp);base64,)/),
        )
        .optional(),
    location: z
        .object({
            latitude: z.number().min(-90).max(90),
            longitude: z.number().min(-180).max(180),
            accuracy: z.number().nonnegative(),
        })
        .optional(),
    currency: z
        .object({ base: id, target: id, amount: z.number().nonnegative() })
        .optional(),
});

function checkBill(
    bill: Pick<Bill, "type" | "categoryId" | "tagIds">,
    meta: GlobalMeta,
) {
    const category = (meta.categories ?? BillCategories).find(
        (item) => item.id === bill.categoryId,
    );
    if (!category || category.type !== bill.type)
        throw new Error("Invalid category for bill type");
    if (bill.tagIds?.some((tag) => !meta.tags?.some((item) => item.id === tag)))
        throw new Error("Unknown bill tag");
}

const category = z.object({
    id,
    name: id,
    type: z.enum(["income", "expense"]),
    icon: z.string(),
    color: z.string(),
    parent: id.optional(),
    defaultSelect: z.boolean().optional(),
});
const tag = z.object({
    id,
    name: id,
    opaque: z.boolean().optional(),
    preferCurrency: id.optional(),
});
const filter = z
    .object({
        comment: z.string(),
        recent: repeat,
        start: z.number(),
        end: z.number(),
        type: z.enum(["income", "expense"]),
        creators: z.array(member),
        categories: z.array(id),
        minAmountNumber: z.number(),
        maxAmountNumber: z.number(),
        assets: z.boolean(),
        scheduled: z.boolean(),
        tags: z.array(id),
        excludeTags: z.array(id),
        baseCurrency: id,
        currencies: z.array(id),
    })
    .partial();

const metaInput = z.discriminatedUnion("resource", [
    z.object({ resource: z.literal("categories"), value: category }),
    z.object({ resource: z.literal("tags"), value: tag }),
    z.object({
        resource: z.literal("tagGroups"),
        value: z.object({
            id,
            name: id,
            color: z.string(),
            singleSelect: z.boolean().optional(),
            required: z.boolean().optional(),
            tagIds: z.array(id).optional(),
        }),
    }),
    z.object({
        resource: z.literal("customFilters"),
        value: z.object({
            id,
            name: id,
            filter,
            displayCurrency: id.optional(),
            modules: z
                .array(
                    z
                        .string()
                        .regex(
                            /^(base-analysis|top-words|map|analysis|top-expense|top-income|widget-.+)$/,
                        ),
                )
                .optional(),
        }),
    }),
    z.object({
        resource: z.literal("budgets"),
        value: z.object({
            id,
            title: id,
            start: z.number(),
            end: z.number().optional(),
            repeat,
            joiners: z.array(member),
            totalBudget: z.number().nonnegative(),
            categoriesBudget: z
                .array(z.object({ id, budget: z.number().nonnegative() }))
                .optional(),
            onlyTags: z.array(id).optional(),
            excludeTags: z.array(id).optional(),
        }),
    }),
    z.object({
        resource: z.literal("customCurrencies"),
        value: z.object({
            id,
            name: id,
            symbol: z.string(),
            rateToBase: z.number().positive(),
        }),
    }),
    z.object({ resource: z.literal("baseCurrency"), value: id }),
    z.object({ resource: z.literal("quickCurrencies"), value: z.array(id) }),
    z.object({
        resource: z.literal("scheduleds"),
        value: z.object({
            id,
            title: id,
            start: z.number(),
            end: z.number().optional(),
            repeat,
            enabled: z.boolean().optional(),
            template: billFields,
        }),
    }),
    z.object({ resource: z.literal("homeWidgets"), value: z.array(id) }),
]);

const validateWidget = widgetOperations.find(
    (tool) => tool.name === "validateWidget",
)!;
const widgetInput = z.discriminatedUnion("action", [
    z.object({ action: z.literal("create"), code: id }),
    z.object({
        action: z.literal("update"),
        id,
        code: id.optional(),
        settings: z.record(z.string(), z.json()).optional(),
        storage: z.record(z.string(), z.json()).optional(),
    }),
    z.object({ action: z.literal("delete"), id }),
]);

export const mutationTools = [
    createTool({
        name: "importBills",
        effect: "write",
        exposure: writable,
        describe:
            "Propose adding bills. Amount is an integer scaled by 10000; time is epoch milliseconds. Use existing category and tag IDs, or supply new definitions under meta.",
        argSchema: z.object({
            items: z.array(billFields).min(1).max(100),
            meta: z
                .object({
                    categories: z.array(category).optional(),
                    tags: z.array(tag).optional(),
                })
                .optional(),
        }),
        returnSchema: z.unknown(),
        handler: ({ items, meta: additions }, ctx) =>
            proposeChange(ctx, "bills", "create", ({ meta, viewer }) => {
                const categories = [...(meta.categories ?? BillCategories)];
                const tags = [...(meta.tags ?? [])];
                for (const item of additions?.categories ?? []) {
                    if (categories.some((old) => old.id === item.id))
                        throw new Error("Category already exists");
                    categories.push({ ...item, customName: true });
                }
                for (const item of additions?.tags ?? []) {
                    if (tags.some((old) => old.id === item.id))
                        throw new Error("Tag already exists");
                    tags.push(item);
                }
                const patches = items.map((bill) => {
                    checkBill(bill, { ...meta, categories, tags });
                    const id = crypto.randomUUID();
                    return { id, after: { ...bill, id, creatorId: viewer } };
                });
                return {
                    alwaysAsk: !!(
                        additions?.categories?.length || additions?.tags?.length
                    ),
                    patches: [
                        ...(additions?.categories?.length
                            ? [
                                  {
                                      key: "categories" as const,
                                      before: meta.categories,
                                      after: categories,
                                  },
                              ]
                            : []),
                        ...(additions?.tags?.length
                            ? [
                                  {
                                      key: "tags" as const,
                                      before: meta.tags,
                                      after: tags,
                                  },
                              ]
                            : []),
                        ...patches,
                    ],
                };
            }),
    }),
    createTool({
        name: "modifyBills",
        effect: "write",
        exposure: writable,
        describe:
            "Propose updating or deleting explicit bill IDs owned by the current user. Amount is an integer scaled by 10000. Use references or query first.",
        argSchema: z.discriminatedUnion("action", [
            z.object({
                action: z.literal("update"),
                items: z
                    .array(z.object({ id, fields: billFields.partial() }))
                    .min(1)
                    .max(100),
            }),
            z.object({
                action: z.literal("delete"),
                ids: z.array(id).min(1).max(100),
            }),
        ]),
        returnSchema: z.unknown(),
        handler: (arg, ctx) =>
            proposeChange(
                ctx,
                "bills",
                arg.action,
                ({ bills, meta, viewer }) => {
                    const entries =
                        arg.action === "update"
                            ? arg.items
                            : arg.ids.map((id) => ({ id, fields: undefined }));
                    if (
                        new Set(entries.map((item) => item.id)).size !==
                        entries.length
                    )
                        throw new Error("Duplicate bill IDs");
                    return {
                        patches: entries.map(({ id, fields }) => {
                            const before = bills.find((bill) => bill.id === id);
                            if (
                                !before ||
                                String(before.creatorId) !== String(viewer)
                            )
                                throw new Error("Bill missing or not editable");
                            const after = fields
                                ? { ...before, ...fields }
                                : undefined;
                            if (after) checkBill(after, meta);
                            return { id, before, after };
                        }),
                    };
                },
            ),
    }),
    createTool({
        name: "modifyWidget",
        effect: "write",
        exposure: writable,
        describe:
            "Propose creating, updating or removing a widget. Preview code via validateWidget first. Updates retain its ID and any unspecified settings/storage.",
        argSchema: widgetInput,
        returnSchema: z.unknown(),
        handler: (arg, ctx) =>
            proposeChange(
                ctx,
                "widgets",
                arg.action,
                async ({ meta, viewer }) => {
                    const widgets = meta.widgets ?? [];
                    const old =
                        arg.action === "create"
                            ? undefined
                            : widgets.find((item) => item.id === arg.id);
                    if (arg.action !== "create" && !old)
                        throw new Error("Widget not found");
                    const fields = arg.action === "update" ? arg : undefined;
                    const code =
                        arg.action === "delete"
                            ? undefined
                            : (arg.code ?? old?.code);
                    const compiled = code ? compileWidget(code) : undefined;
                    if (compiled && (!compiled.name || !compiled.apiVersion))
                        throw new Error("Missing widget metadata");
                    if (code && (code !== old?.code || fields?.storage)) {
                        const validated = (await validateWidget.handler(
                            { code, storage: fields?.storage ?? old?.storage },
                            ctx,
                        )) as { valid: boolean; error?: string };
                        if (!validated.valid)
                            throw new Error(
                                validated.error ?? "Widget preview failed",
                            );
                    }
                    const updated =
                        compiled && code
                            ? {
                                  id: old?.id ?? crypto.randomUUID(),
                                  code,
                                  name: compiled.name,
                                  permissions: compiled.permissions,
                                  createdAt: old?.createdAt ?? Date.now(),
                                  updatedAt: Date.now(),
                                  ...((fields?.settings ?? old?.settings)
                                      ? {
                                            settings:
                                                fields?.settings ??
                                                old?.settings,
                                        }
                                      : {}),
                                  ...((fields?.storage ?? old?.storage)
                                      ? {
                                            storage:
                                                fields?.storage ?? old?.storage,
                                        }
                                      : {}),
                              }
                            : undefined;
                    const next = old
                        ? widgets.flatMap((item) =>
                              item.id !== old.id
                                  ? [item]
                                  : updated
                                    ? [updated]
                                    : [],
                          )
                        : [...widgets, updated!];
                    const home = meta.personal?.[viewer]?.homeWidgets;
                    return {
                        alwaysAsk: !!compiled?.permissions.some(
                            (permission) =>
                                !old?.permissions.includes(permission),
                        ),
                        patches: [
                            {
                                key: "widgets",
                                before: meta.widgets,
                                after: next,
                            },
                            ...(arg.action === "delete" &&
                            home?.includes(arg.id)
                                ? [
                                      {
                                          key: "personal" as const,
                                          user: viewer,
                                          field: "homeWidgets",
                                          before: home,
                                          after: home.filter(
                                              (id) => id !== arg.id,
                                          ),
                                      },
                                  ]
                                : []),
                        ],
                    };
                },
            ),
    }),
    createTool({
        name: "editLedgerMetadata",
        effect: "write",
        exposure: writable,
        describe:
            "Propose upserting a business metadata record by ID, or setting a currency/home widget list. Does not delete metadata or edit credentials.",
        argSchema: metaInput,
        returnSchema: z.unknown(),
        handler: ({ resource, value }, ctx) =>
            proposeChange(
                ctx,
                resource,
                "update",
                ({ meta, viewer, bills }) => {
                    if (
                        resource === "baseCurrency" ||
                        resource === "quickCurrencies"
                    ) {
                        if (resource === "baseCurrency" && bills.length)
                            throw new Error(
                                "Changing the base currency of a populated ledger requires the Cent currency workflow",
                            );
                        return {
                            patches: [
                                {
                                    key: resource,
                                    before: meta[resource],
                                    after: value,
                                },
                            ],
                        };
                    }
                    const personal = meta.personal?.[viewer];
                    if (resource === "homeWidgets") {
                        if (
                            value.some(
                                (id) =>
                                    !meta.widgets?.some(
                                        (widget) => widget.id === id,
                                    ),
                            )
                        )
                            throw new Error("Unknown home widget");
                        return {
                            patches: [
                                {
                                    key: "personal",
                                    user: viewer,
                                    field: resource,
                                    before: personal?.homeWidgets,
                                    after: [...new Set(value)],
                                },
                            ],
                        };
                    }
                    if (resource === "scheduleds")
                        checkBill(value.template, meta);
                    if (
                        resource === "tagGroups" &&
                        value.tagIds?.some(
                            (id) => !meta.tags?.some((tag) => tag.id === id),
                        )
                    )
                        throw new Error("Unknown group tag");
                    if (resource === "categories") {
                        const categories = meta.categories ?? BillCategories;
                        if (
                            value.parent &&
                            (value.parent === value.id ||
                                !categories.some(
                                    (item) =>
                                        item.id === value.parent &&
                                        item.type === value.type &&
                                        !item.parent,
                                ))
                        )
                            throw new Error("Invalid category parent");
                        if (
                            bills.some(
                                (bill) =>
                                    bill.categoryId === value.id &&
                                    bill.type !== value.type,
                            )
                        )
                            throw new Error(
                                "Category type conflicts with existing bills",
                            );
                    }
                    const before =
                        resource === "scheduleds" || resource === "tagGroups"
                            ? personal?.[resource]
                            : meta[resource];
                    const old =
                        before ??
                        (resource === "categories" ? BillCategories : []);
                    const previous = old.find((item) => item.id === value.id);
                    const entry = {
                        ...previous,
                        ...value,
                        ...(resource === "categories"
                            ? { customName: true }
                            : {}),
                    };
                    const after = previous
                        ? old.map((item) =>
                              item.id === value.id ? entry : item,
                          )
                        : [...old, entry];
                    return {
                        patches: [
                            resource === "scheduleds" ||
                            resource === "tagGroups"
                                ? {
                                      key: "personal",
                                      user: viewer,
                                      field: resource,
                                      before,
                                      after,
                                  }
                                : { key: resource, before, after },
                        ],
                    };
                },
            ),
    }),
    createTool({
        name: "getChangeStatus",
        exposure: native,
        describe:
            "Read the result of a WebMCP change by ID. A pending result requires the user to approve in Cent.",
        argSchema: z.object({ changeId: id }),
        returnSchema: z.unknown(),
        handler: ({ changeId }) => getChangeStatus(changeId),
    }),
] as Tool[];
