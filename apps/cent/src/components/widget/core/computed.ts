import { z } from "zod";
import type {
    BillFilterView,
    BillTagGroup,
    CustomCurrency,
} from "@/ledger/extra-type";
import type { BillCategory, BillTag } from "@/ledger/type";

const base = {
    id: z.string().min(1),
    name: z.string(),
    position: z
        .number()
        .int()
        .nonnegative()
        .max(Number.MAX_SAFE_INTEGER)
        .optional(),
};
const schema = z.object({
    customCurrencies: z
        .array(
            z.object({
                ...base,
                symbol: z.string(),
                rateToBase: z.number().finite().positive(),
            }),
        )
        .max(1000)
        .default([]),
    categories: z
        .array(
            z.object({
                ...base,
                type: z.enum(["income", "expense"]),
                icon: z.string().default(""),
                color: z.string().default(""),
                parent: z.string().optional(),
                defaultSelect: z.boolean().optional(),
            }),
        )
        .max(1000)
        .default([]),
    tags: z
        .array(
            z.object({
                ...base,
                opaque: z.boolean().optional(),
                preferCurrency: z.string().optional(),
            }),
        )
        .max(1000)
        .default([]),
    tagGroups: z
        .array(
            z.object({
                ...base,
                color: z.string().default(""),
                singleSelect: z.boolean().optional(),
                required: z.boolean().optional(),
                tagIds: z.array(z.string()).optional(),
            }),
        )
        .max(1000)
        .default([]),
    customFilters: z
        .array(
            z.object({
                ...base,
                filter: z.object({
                    comment: z.string().optional(),
                    recent: z
                        .object({
                            value: z.number(),
                            unit: z.enum(["year", "month", "week", "day"]),
                        })
                        .optional(),
                    start: z.number().optional(),
                    end: z.number().optional(),
                    type: z.enum(["income", "expense"]).optional(),
                    creators: z
                        .array(z.union([z.string(), z.number()]))
                        .optional(),
                    categories: z.array(z.string()).optional(),
                    minAmountNumber: z.number().optional(),
                    maxAmountNumber: z.number().optional(),
                    assets: z.boolean().optional(),
                    scheduled: z.boolean().optional(),
                    tags: z.array(z.string()).optional(),
                    excludeTags: z.array(z.string()).optional(),
                    baseCurrency: z.string().optional(),
                    currencies: z.array(z.string()).optional(),
                }),
                displayCurrency: z.string().optional(),
                modules: z.array(z.string()).optional(),
            }),
        )
        .max(1000)
        .default([]),
});
export type ComputedDeclaration<T> = T & { position?: number };
export type ComputedEntry<T> = ComputedDeclaration<T> & { widgetId: string };
export type EffectiveEntry<T> = T | ComputedEntry<T>;
type MetadataTypes = {
    customCurrencies: CustomCurrency;
    categories: BillCategory;
    tags: BillTag;
    tagGroups: BillTagGroup;
    customFilters: BillFilterView;
};
export type ComputedDeclarations = {
    [K in keyof MetadataTypes]?: ComputedDeclaration<MetadataTypes[K]>[];
};
export type ComputedMeta = {
    [K in keyof MetadataTypes]: ComputedEntry<MetadataTypes[K]>[];
};
export function isComputedEntry<T extends object>(
    item: T | null | undefined,
): item is T & ComputedEntry<T> {
    return !!item && "widgetId" in item && typeof item.widgetId === "string";
}
export const emptyComputed: ComputedMeta = {
    customCurrencies: [],
    categories: [],
    tags: [],
    tagGroups: [],
    customFilters: [],
};
export function validateComputed(
    value: unknown,
    widgetId: string,
): ComputedMeta {
    const parsed = schema.parse(value);
    for (const items of Object.values(parsed)) {
        const seen = new Set<string>();
        for (const item of items) {
            if (!item.id.startsWith(`wc-${widgetId}:`) || seen.has(item.id))
                throw new Error(
                    "Computed IDs must be unique and created with ctx.id()",
                );
            seen.add(item.id);
        }
    }
    const owner = <T>(items: T[]) =>
        items.map((item) => ({ ...item, widgetId }));
    return {
        customCurrencies: owner(parsed.customCurrencies),
        categories: owner(parsed.categories).map((c) => ({
            ...c,
            customName: true,
        })),
        tags: owner(parsed.tags),
        tagGroups: owner(parsed.tagGroups),
        customFilters: owner(
            parsed.customFilters,
        ) as ComputedEntry<BillFilterView>[],
    };
}
/** Positions refer to slots in the original list, never an intermediate merge. */
export function insertComputed<T>(
    base: readonly T[],
    computed: readonly ComputedEntry<T>[],
): EffectiveEntry<T>[] {
    const slots = new Map<number, ComputedEntry<T>[]>();
    for (const item of computed) {
        const position = Math.min(item.position ?? base.length, base.length);
        const slot = slots.get(position) ?? [];
        slot.push(item);
        slots.set(position, slot);
    }
    const result: EffectiveEntry<T>[] = [];
    for (let index = 0; index <= base.length; index++) {
        result.push(...(slots.get(index) ?? []));
        if (index < base.length) result.push(base[index]);
    }
    return result;
}
export function assertEditable(id: string) {
    if (id.startsWith("wc-"))
        throw new Error("Computed metadata is managed by its widget");
}
