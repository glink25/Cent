import { z } from "zod";

const ZenThemeSchema = z.object({
    id: z.string().min(1),
    title: z.string().min(1),
    subtitle: z.string().optional(),
    tags: z.array(z.string()),
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

const ZenChoiceOptionSchema = z.object({
    id: z.string().min(1).max(60),
    label: z.string().min(1).max(120),
    description: z.string().max(240).optional(),
});

const fieldBase = {
    id: z.string().min(1).max(60),
    label: z.string().min(1).max(160),
    description: z.string().max(300).optional(),
    required: z.boolean().optional(),
};

const TextFieldSchema = z
    .object({
        ...fieldBase,
        type: z.enum(["shortText", "longText"]),
        placeholder: z.string().max(200).optional(),
        defaultValue: z.string().optional(),
        minLength: z.number().int().min(0).max(600).optional(),
        maxLength: z.number().int().min(1).max(1200).optional(),
    })
    .refine(
        (field) =>
            field.minLength === undefined ||
            field.maxLength === undefined ||
            field.minLength <= field.maxLength,
        { message: "minLength must not exceed maxLength" },
    );

const SingleChoiceFieldSchema = z.object({
    ...fieldBase,
    type: z.enum(["singleChoice", "select"]),
    options: z.array(ZenChoiceOptionSchema).min(2).max(10),
    defaultValue: z.string().optional(),
});

const MultiChoiceFieldSchema = z
    .object({
        ...fieldBase,
        type: z.literal("multiChoice"),
        options: z.array(ZenChoiceOptionSchema).min(2).max(12),
        defaultValue: z.array(z.string()).optional(),
        minSelections: z.number().int().min(0).max(12).optional(),
        maxSelections: z.number().int().min(1).max(12).optional(),
    })
    .refine(
        (field) =>
            field.minSelections === undefined ||
            field.maxSelections === undefined ||
            field.minSelections <= field.maxSelections,
        { message: "minSelections must not exceed maxSelections" },
    );

const SliderFieldSchema = z
    .object({
        ...fieldBase,
        type: z.literal("slider"),
        min: z.number(),
        max: z.number(),
        step: z.number().positive().optional(),
        defaultValue: z.number(),
        minLabel: z.string().max(100).optional(),
        maxLabel: z.string().max(100).optional(),
    })
    .refine((field) => field.max > field.min, {
        message: "max must be greater than min",
    })
    .refine(
        (field) =>
            field.defaultValue >= field.min && field.defaultValue <= field.max,
        { message: "defaultValue must be within range" },
    );

const RatingFieldSchema = z
    .object({
        ...fieldBase,
        type: z.literal("rating"),
        max: z.number().int().min(2).max(10),
        defaultValue: z.number().int().positive().optional(),
        lowLabel: z.string().max(100).optional(),
        highLabel: z.string().max(100).optional(),
    })
    .refine(
        (field) =>
            field.defaultValue === undefined || field.defaultValue <= field.max,
        { message: "defaultValue must not exceed max" },
    );

const ToggleFieldSchema = z.object({
    ...fieldBase,
    type: z.literal("toggle"),
    defaultValue: z.boolean().optional(),
});

export const ZenFormFieldSchema = z.union([
    TextFieldSchema,
    SingleChoiceFieldSchema,
    MultiChoiceFieldSchema,
    SliderFieldSchema,
    RatingFieldSchema,
    ToggleFieldSchema,
]);

export const ZenContentBlockSchema = z.discriminatedUnion("type", [
    z.object({
        type: z.literal("text"),
        body: z.string().min(1).max(1200),
        tone: z.enum(["default", "muted"]).optional(),
    }),
    z.object({
        type: z.literal("callout"),
        title: z.string().max(160).optional(),
        body: z.string().min(1).max(800),
        tone: z.enum(["gentle", "insight", "celebration"]).optional(),
    }),
    z.object({
        type: z.literal("entityList"),
        entityType: z.enum(["bill", "category", "budget"]),
        ids: z.array(z.string()).min(1).max(12),
        title: z.string().max(160).optional(),
        display: z.enum(["list", "grid", "timeline"]).optional(),
    }),
]);

const ZenIntentSchema = z.enum([
    "theme_selection",
    "reflection",
    "action",
    "summary",
    "ending",
]);

const ZenProgressSchema = z.object({
    current: z.number().int().min(1),
    max: z.number().int().min(1).max(12),
    shouldEndSoon: z.boolean(),
});

const ZenDirectorStateSchema = z.object({
    phase: z.enum([
        "focus",
        "evidence",
        "meaning",
        "pattern",
        "intention",
        "closing",
    ]),
    coveredDimensions: z.array(
        z.enum(["data_pattern", "context_motivation", "feeling_value"]),
    ),
    lastResponseSummary: z.string().max(200).optional(),
    insightSummary: z.string().max(200).optional(),
    openQuestion: z.string().max(200).optional(),
});

const stepBase = {
    stepId: z.string().min(1).max(80),
    sessionId: z.string().min(1),
    intent: ZenIntentSchema,
    title: z.string().min(1).max(180),
    description: z.string().max(500).optional(),
    content: z.array(ZenContentBlockSchema).max(8),
    progress: ZenProgressSchema,
    directorState: ZenDirectorStateSchema.optional(),
};

const ZenInteractionStepSchema = z
    .object({
        ...stepBase,
        mode: z.literal("interaction"),
        fields: z.array(ZenFormFieldSchema).min(1).max(8),
        submitLabel: z.string().min(1).max(40),
        allowSkip: z.boolean(),
        skipLabel: z.string().max(40).optional(),
    })
    .refine(
        (step) =>
            new Set(step.fields.map((field) => field.id)).size ===
            step.fields.length,
        { message: "field ids must be unique" },
    );

const ZenCompletionSchema = z.object({
    title: z.string().min(1).max(180),
    quote: z.string().min(1).max(400),
    summary: z.string().min(1).max(1600),
    intention: z.string().max(400).optional(),
    tags: z.array(z.string().max(60)).max(12).optional(),
});

const ZenCompletionStepSchema = z.object({
    ...stepBase,
    mode: z.literal("completion"),
    intent: z.literal("ending"),
    completion: ZenCompletionSchema,
});

export const ZenUIStepSchema = z.discriminatedUnion("mode", [
    ZenInteractionStepSchema,
    ZenCompletionStepSchema,
]);

/**
 * Model-facing schema deliberately stays as one plain object. Some function
 * calling providers (notably OpenAPI-subset implementations) cannot reliably
 * consume a root-level oneOf/anyOf. The tool handler validates this permissive
 * wire shape again with ZenUIStepSchema before anything reaches the UI.
 */
const ZenToolContentBlockSchema = z.object({
    type: z.enum(["text", "callout", "entityList"]),
    body: z.string().max(1200).optional(),
    tone: z
        .enum(["default", "muted", "gentle", "insight", "celebration"])
        .optional(),
    title: z.string().max(160).optional(),
    entityType: z.enum(["bill", "category", "budget"]).optional(),
    ids: z.array(z.string()).max(12).optional(),
    display: z.enum(["list", "grid", "timeline"]).optional(),
});

const ZenToolFieldSchema = z.object({
    id: z.string().min(1).max(60),
    type: z.enum([
        "shortText",
        "longText",
        "singleChoice",
        "multiChoice",
        "select",
        "slider",
        "rating",
        "toggle",
    ]),
    label: z.string().min(1).max(160),
    description: z.string().max(300).optional(),
    required: z.boolean().optional(),
    placeholder: z.string().max(200).optional(),
    options: z.array(ZenChoiceOptionSchema).max(12).optional(),
    // Model-created defaults are only needed by sliders. Other controls have
    // deterministic UI defaults, which keeps the wire schema free of anyOf.
    defaultValue: z.number().optional(),
    minLength: z.number().int().min(0).max(600).optional(),
    maxLength: z.number().int().min(1).max(1200).optional(),
    minSelections: z.number().int().min(0).max(12).optional(),
    maxSelections: z.number().int().min(1).max(12).optional(),
    min: z.number().optional(),
    max: z.number().optional(),
    step: z.number().optional(),
    minLabel: z.string().max(100).optional(),
    maxLabel: z.string().max(100).optional(),
    lowLabel: z.string().max(100).optional(),
    highLabel: z.string().max(100).optional(),
});

export const ZenUIStepToolSchema = z.object({
    stepId: z.string().min(1).max(80),
    sessionId: z.string().min(1),
    mode: z.enum(["interaction", "completion"]),
    intent: ZenIntentSchema,
    title: z.string().min(1).max(180),
    description: z.string().max(500).optional(),
    content: z.array(ZenToolContentBlockSchema).max(8),
    fields: z.array(ZenToolFieldSchema).max(8).optional(),
    submitLabel: z.string().min(1).max(40).optional(),
    allowSkip: z.boolean().optional(),
    skipLabel: z.string().max(40).optional(),
    completion: ZenCompletionSchema.optional(),
    progress: ZenProgressSchema,
    directorState: ZenDirectorStateSchema.optional(),
});

export const ZenFormSubmissionSchema = z.object({
    action: z.enum(["submit", "skip"]),
    values: z.record(
        z.string(),
        z.union([z.string(), z.array(z.string()), z.number(), z.boolean()]),
    ),
});

const ZenEntitySnapshotSchema = z.discriminatedUnion("entityType", [
    z.object({
        entityType: z.literal("bill"),
        id: z.string(),
        type: z.enum(["income", "expense"]),
        categoryName: z.string(),
        amount: z.number(),
        time: z.number(),
        comment: z.string().optional(),
    }),
    z.object({
        entityType: z.literal("category"),
        id: z.string(),
        name: z.string(),
        amount: z.number(),
        count: z.number(),
        type: z.enum(["income", "expense"]),
    }),
    z.object({
        entityType: z.literal("budget"),
        id: z.string(),
        title: z.string(),
        periodStart: z.number(),
        periodEnd: z.number(),
        totalBudget: z.number(),
        totalUsed: z.number(),
        ratio: z.number(),
        status: z.enum(["normal", "near_limit", "over_limit"]),
    }),
]);

const ZenPostStepRecordSchema = z.object({
    stepId: z.string(),
    intent: ZenIntentSchema,
    step: ZenInteractionStepSchema,
    submission: ZenFormSubmissionSchema,
    summary: z.string(),
    entitySnapshots: z.array(ZenEntitySnapshotSchema),
    createdAt: z.number(),
});

export const ZenPostSchema = z.object({
    id: z.string().min(1),
    userId: z.string().min(1),
    time: z.number(),
    bookId: z.string().min(1),
    period: ZenPeriodSchema,
    title: z.string().optional(),
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
    stepRecords: z.array(ZenPostStepRecordSchema).optional(),
    steps: z.array(z.unknown()).optional(),
    cardSummaries: z.array(z.string()).optional(),
    tags: z.array(z.string()),
    createdAt: z.number(),
    completedAt: z.number(),
});

export type ZenUIStepInput = z.infer<typeof ZenUIStepSchema>;
