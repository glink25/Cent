import { z } from "zod";

const ZenThemeSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    tags: z.array(z.string()).default([]),
});

export const ZenPeriodSchema = z.object({
    type: z.enum(["daily", "weekly", "monthly", "custom"]),
    start: z.number(),
    end: z.number(),
});

const ZenSuggestedPeriodSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    period: ZenPeriodSchema,
    reason: z.string().min(1),
});

export const ZenFocusDecisionSchema = z.object({
    period: ZenPeriodSchema,
    label: z.string().min(1),
    reason: z.string().min(1),
    comparisonPeriods: z.array(ZenSuggestedPeriodSchema).optional(),
    focusSignals: z.array(z.string()).optional(),
});

const ThemeSelectorCardSchema = z.object({
    type: z.literal("ThemeSelectorCard"),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    options: z.array(ZenThemeSchema).min(2).max(4),
    recommendedOptionId: z.string().optional(),
    reason: z.string().optional(),
});

const InsightTextCardSchema = z.object({
    type: z.literal("InsightTextCard"),
    title: z.string().min(1),
    body: z.string().min(1),
    tone: z
        .enum([
            "gentle",
            "reflective",
            "direct",
            "celebratory",
            "grounding",
            "playful",
        ])
        .optional(),
    relatedBillIds: z.array(z.string()).optional(),
    relatedCategoryIds: z.array(z.string()).optional(),
});

const SliderCardSchema = z
    .object({
        type: z.literal("SliderCard"),
        title: z.string().min(1),
        description: z.string().optional(),
        minLabel: z.string().min(1),
        maxLabel: z.string().min(1),
        minValue: z.number(),
        maxValue: z.number(),
        defaultValue: z.number(),
    })
    .refine((value) => value.maxValue > value.minValue, {
        message: "maxValue must be greater than minValue",
    })
    .refine(
        (value) =>
            value.defaultValue >= value.minValue &&
            value.defaultValue <= value.maxValue,
        {
            message: "defaultValue must be within range",
        },
    );

const FreeInputCardSchema = z.object({
    type: z.literal("FreeInputCard"),
    title: z.string().min(1),
    placeholder: z.string().min(1),
    inputMode: z.enum(["text", "voice", "both"]),
    maxLength: z.number().int().min(20).max(600),
    helperText: z.string().optional(),
});

const BillFocusCardSchema = z.object({
    type: z.literal("BillFocusCard"),
    title: z.string().min(1),
    description: z.string().optional(),
    billIds: z.array(z.string()).min(1).max(12),
    displayMode: z.enum(["single", "group", "timeline"]),
    question: z.string().optional(),
});

const ChoiceCardOptionSchema = z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    description: z.string().optional(),
});

const ChoiceCardSchema = z.object({
    type: z.literal("ChoiceCard"),
    title: z.string().min(1),
    description: z.string().optional(),
    options: z.array(ChoiceCardOptionSchema).min(2).max(8),
    allowMultiple: z.boolean(),
    allowSkip: z.boolean(),
});

const ShredderCardSchema = z.object({
    type: z.literal("ShredderCard"),
    title: z.string().min(1),
    items: z
        .array(
            z.object({
                id: z.string().min(1),
                label: z.string().min(1),
                description: z.string().optional(),
                amount: z.number().optional(),
                categoryName: z.string().optional(),
                billIds: z.array(z.string()).optional(),
            }),
        )
        .min(1)
        .max(8),
    actions: z
        .array(z.enum(["keep", "pause", "observe", "reduce"]))
        .min(1)
        .max(4),
});

const BudgetAdjustCardSchema = z.object({
    type: z.literal("BudgetAdjustCard"),
    title: z.string().min(1),
    categoryId: z.string().optional(),
    categoryName: z.string().optional(),
    currentBudget: z.number().nonnegative(),
    currentUsed: z.number().nonnegative().optional(),
    suggestedBudget: z.number().nonnegative(),
    reason: z.string().min(1),
    confirmAction: z.string().min(1),
});

const IntentionCardSchema = z.object({
    type: z.literal("IntentionCard"),
    title: z.string().min(1),
    suggestions: z.array(z.string().min(1)).min(1).max(6),
    customInputEnabled: z.boolean(),
    duration: z.enum(["day", "week", "month"]),
    reminderEnabled: z.boolean(),
});

const ZenEpilogueCardSchema = z.object({
    type: z.literal("ZenEpilogueCard"),
    title: z.string().min(1),
    quote: z.string().min(1),
    summary: z.string().min(1),
    intention: z.string().optional(),
    actions: z.array(z.string()).optional(),
    shareable: z.boolean().optional(),
});

export const ZenComponentSchema = z.discriminatedUnion("type", [
    ThemeSelectorCardSchema,
    InsightTextCardSchema,
    SliderCardSchema,
    FreeInputCardSchema,
    BillFocusCardSchema,
    ChoiceCardSchema,
    ShredderCardSchema,
    BudgetAdjustCardSchema,
    IntentionCardSchema,
    ZenEpilogueCardSchema,
]);

export const ZenUIStepSchema = z.object({
    stepId: z.string().min(1),
    sessionId: z.string().min(1),
    component: ZenComponentSchema,
    intent: z.enum([
        "theme_selection",
        "reflection",
        "action",
        "summary",
        "ending",
    ]),
    progress: z.object({
        current: z.number().int().min(1),
        max: z.number().int().min(1).max(5),
        shouldEndSoon: z.boolean(),
    }),
    dataBindings: z
        .object({
            billIds: z.array(z.string()).optional(),
            categoryIds: z.array(z.string()).optional(),
            budgetIds: z.array(z.string()).optional(),
            tagIds: z.array(z.string()).optional(),
        })
        .optional(),
    nextPolicy: z.object({
        waitForUserInput: z.boolean(),
        allowedUserActions: z.array(z.string()).min(1),
    }),
});

export const ZenPostSchema = z.object({
    id: z.string().min(1),
    bookId: z.string().min(1),
    period: ZenPeriodSchema,
    mood: z
        .enum([
            "calm",
            "tired",
            "anxious",
            "confused",
            "satisfied",
            "motivated",
            "avoidant",
        ])
        .optional(),
    theme: ZenThemeSchema.optional(),
    summary: z.string(),
    quote: z.string(),
    intention: z.string().optional(),
    cardSummaries: z.array(z.string()),
    tags: z.array(z.string()),
    createdAt: z.number(),
    completedAt: z.number(),
});

export type ZenUIStepInput = z.infer<typeof ZenUIStepSchema>;
