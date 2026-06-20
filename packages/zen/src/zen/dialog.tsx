import "./zen.css";
import dayjs from "dayjs";
import {
    type CSSProperties,
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import Loading from "../components/loading";
import { useIntl } from "../i18n";
import { useZenRuntime } from "../runtime/context";
import { cn } from "../utils";
import { getZenDayId, getZenStyleName, isZenEntranceOpen } from "./date";
import { requestNextZenStep } from "./director";
import {
    createFallbackEpilogueStep,
    createLocalZenJourneyPlan,
    createLocalZenSeed,
} from "./fallback";
import {
    createZenExplorationState,
    createZenJourneyPlan,
    extendZenJourney,
    mergeDirectorState,
    recordZenResponse,
} from "./journey";
import { ZenPostsView } from "./posts-list";
import type {
    ZenContentBlock,
    ZenContext,
    ZenEntitySnapshot,
    ZenFormField,
    ZenFormSubmission,
    ZenFormValue,
    ZenPost,
    ZenSessionState,
    ZenUIStep,
} from "./types";

type ZenDialogState =
    | { type: "loading" }
    | { type: "error"; message: string }
    | { type: "locked"; scheduledTime: string }
    | { type: "completed"; post: ZenPost }
    | { type: "active"; session: ZenSessionState; context: ZenContext };

function createJourneyState(
    local: boolean,
    lastZenPost: ZenPost | undefined,
    now: number,
) {
    if (!local)
        return {
            journeyPlan: createZenJourneyPlan(lastZenPost, now),
            localSeed: undefined,
        };
    const localSeed = createLocalZenSeed();
    return {
        journeyPlan: createLocalZenJourneyPlan(localSeed),
        localSeed,
    };
}

function formatAmount(amount: number, currency: string) {
    return `${amount.toFixed(2)} ${currency}`;
}

function defaultFieldValue(field: ZenFormField): ZenFormValue {
    if (field.type === "multiChoice") return field.defaultValue ?? [];
    if (field.type === "slider") return field.defaultValue;
    if (field.type === "rating") return field.defaultValue ?? 0;
    if (field.type === "toggle") return field.defaultValue ?? false;
    return field.defaultValue ?? "";
}

function initialValues(fields: ZenFormField[]) {
    return Object.fromEntries(
        fields.map((field) => [field.id, defaultFieldValue(field)]),
    );
}

function isEmptyValue(value: ZenFormValue | undefined) {
    return (
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0)
    );
}

function isFieldValid(field: ZenFormField, value: ZenFormValue | undefined) {
    if (field.required && isEmptyValue(value)) return false;
    if (
        (field.type === "shortText" || field.type === "longText") &&
        typeof value === "string"
    ) {
        if (field.minLength !== undefined && value.length < field.minLength)
            return false;
        if (field.maxLength !== undefined && value.length > field.maxLength)
            return false;
    }
    if (field.type === "multiChoice" && Array.isArray(value)) {
        if (
            field.minSelections !== undefined &&
            value.length < field.minSelections
        )
            return false;
        if (
            field.maxSelections !== undefined &&
            value.length > field.maxSelections
        )
            return false;
    }
    return true;
}

function valueLabel(field: ZenFormField, value: ZenFormValue | undefined) {
    if (value === undefined) return "";
    if (field.type === "singleChoice" || field.type === "select") {
        return (
            field.options.find((option) => option.id === value)?.label ??
            String(value)
        );
    }
    if (field.type === "multiChoice") {
        return (Array.isArray(value) ? value : [])
            .map(
                (id) =>
                    field.options.find((option) => option.id === id)?.label ??
                    id,
            )
            .join("、");
    }
    if (typeof value === "boolean") return value ? "是" : "否";
    return String(value);
}

function summarizeSubmission(
    step: Extract<ZenUIStep, { mode: "interaction" }>,
    submission: ZenFormSubmission,
) {
    if (submission.action === "skip") return `${step.title}：跳过`;
    const entries = step.fields
        .map((field) => {
            const label = valueLabel(field, submission.values[field.id]);
            return label ? `${field.label}：${label}` : undefined;
        })
        .filter(Boolean);
    return entries.join("；") || `${step.title}：已查看`;
}

function collectEntitySnapshots(step: ZenUIStep, context: ZenContext) {
    const snapshots: ZenEntitySnapshot[] = [];
    const seen = new Set<string>();
    for (const block of step.content) {
        if (block.type !== "entityList") continue;
        for (const id of block.ids) {
            const key = `${block.entityType}:${id}`;
            if (seen.has(key)) continue;
            if (block.entityType === "bill") {
                const bill = context.candidateBills.find(
                    (item) => item.id === id,
                );
                if (bill) snapshots.push({ entityType: "bill", ...bill });
            } else if (block.entityType === "category") {
                const category = context.topCategories.find(
                    (item) => item.id === id,
                );
                if (category)
                    snapshots.push({ entityType: "category", ...category });
            } else {
                const budget = context.budgets.find((item) => item.id === id);
                if (budget) {
                    snapshots.push({
                        entityType: "budget",
                        id: budget.id,
                        title: budget.title,
                        periodStart: budget.periodStart,
                        periodEnd: budget.periodEnd,
                        totalBudget: budget.totalBudget,
                        totalUsed: budget.totalUsed,
                        ratio: budget.ratio,
                        status: budget.status,
                    });
                }
            }
            seen.add(key);
        }
    }
    return snapshots;
}

function createSessionStep(
    step: Extract<ZenUIStep, { mode: "interaction" }>,
    submission: ZenFormSubmission,
    context: ZenContext,
) {
    return {
        stepId: step.stepId,
        intent: step.intent,
        step,
        submission,
        summary: summarizeSubmission(step, submission),
        entitySnapshots: collectEntitySnapshots(step, context),
        createdAt: Date.now(),
    };
}

function buildZenPost(session: ZenSessionState, ending: ZenUIStep): ZenPost {
    const completion =
        ending.mode === "completion"
            ? ending.completion
            : (
                  createFallbackEpilogueStep(session) as Extract<
                      ZenUIStep,
                      { mode: "completion" }
                  >
              ).completion;
    const now = Date.now();
    return {
        id: `zen-${session.id}-${session.userId}`,
        userId: session.userId,
        time: dayjs(session.id).startOf("day").valueOf(),
        bookId: session.bookId,
        period: session.period,
        title: completion.title,
        mood: session.mood,
        summary: completion.summary,
        quote: completion.quote,
        intention: completion.intention,
        stepRecords: session.steps.map((step) => ({ ...step })),
        tags: completion.tags ?? [],
        createdAt: session.createdAt,
        completedAt: now,
    };
}

function CardShell({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "zen-card zen-card-enter z-[3] relative flex min-h-0 flex-1 overflow-hidden rounded-[2rem]",
                className,
            )}
        >
            <div className="relative flex min-h-0 flex-1 flex-col">
                {children}
            </div>
        </div>
    );
}

function ZenBackdropFx(_props: { styleName: string }) {
    return null;
}

function ZenCardLayout({
    header,
    children,
    footer,
}: {
    header: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
}) {
    return (
        <>
            <div className="shrink-0 p-5 pb-4 sm:p-7 sm:pb-5">{header}</div>
            <div
                className={cn(
                    "min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7 sm:pb-7",
                    footer && "pb-4 sm:pb-5",
                )}
            >
                {children}
            </div>
            {footer && (
                <div className="zen-footer shrink-0 px-5 pb-5 pt-3 sm:px-7 sm:pb-7">
                    {footer}
                </div>
            )}
        </>
    );
}

function ZenSurface({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("zen-surface rounded-[1.35rem] p-4", className)}>
            {children}
        </div>
    );
}

function ZenActions({
    children,
    className,
}: {
    children: ReactNode;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end",
                className,
            )}
        >
            {children}
        </div>
    );
}

function ZenButton({
    children,
    variant = "primary",
    className,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "ghost";
}) {
    return (
        <button
            type="button"
            className={cn(
                "zen-btn inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-medium transition duration-300 disabled:pointer-events-none disabled:opacity-45",
                variant === "ghost" && "zen-btn--ghost",
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}

function ZenOptionButton({
    children,
    active,
    className,
    ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
    return (
        <button
            type="button"
            className={cn(
                "zen-option group relative min-h-16 overflow-hidden rounded-[1.35rem] p-4 text-left transition duration-300 hover:-translate-y-0.5 disabled:pointer-events-none disabled:opacity-55",
                active && "zen-option--active",
                className,
            )}
            {...props}
        >
            <span className="zen-option-bar pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full transition" />
            <span className="relative block">{children}</span>
        </button>
    );
}

function EmptyEntityList() {
    const t = useIntl();
    return (
        <ZenSurface className="text-sm leading-6 zen-text-muted">
            {t("zen-bill-focus-empty")}
        </ZenSurface>
    );
}

function EntityList({
    block,
    context,
}: {
    block: Extract<ZenContentBlock, { type: "entityList" }>;
    context: ZenContext;
}) {
    const bills =
        block.entityType === "bill"
            ? block.ids
                  .map((id) =>
                      context.candidateBills.find((item) => item.id === id),
                  )
                  .filter(Boolean)
            : [];
    const categories =
        block.entityType === "category"
            ? block.ids
                  .map((id) =>
                      context.topCategories.find((item) => item.id === id),
                  )
                  .filter(Boolean)
            : [];
    const budgets =
        block.entityType === "budget"
            ? block.ids
                  .map((id) => context.budgets.find((item) => item.id === id))
                  .filter(Boolean)
            : [];
    const hasItems = bills.length + categories.length + budgets.length > 0;
    return (
        <div
            className={cn(
                "grid gap-3",
                block.display === "grid" && "sm:grid-cols-2",
            )}
        >
            {block.title && (
                <h3 className="text-sm font-medium zen-heading">
                    {block.title}
                </h3>
            )}
            {!hasItems && <EmptyEntityList />}
            {bills.map(
                (bill) =>
                    bill && (
                        <ZenSurface key={bill.id}>
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <div className="text-sm font-medium zen-heading">
                                        {bill.categoryName}
                                    </div>
                                    <div className="mt-1 text-xs zen-text-subtle">
                                        {dayjs(bill.time).format("YYYY-MM-DD")}
                                    </div>
                                </div>
                                <div className="zen-chip rounded-full px-3 py-1 text-sm font-semibold">
                                    {formatAmount(
                                        bill.amount,
                                        context.summary.currency,
                                    )}
                                </div>
                            </div>
                            {bill.comment && (
                                <p className="mt-3 text-xs leading-5 zen-text-subtle">
                                    {bill.comment}
                                </p>
                            )}
                        </ZenSurface>
                    ),
            )}
            {categories.map(
                (category) =>
                    category && (
                        <ZenSurface key={category.id}>
                            <div className="text-sm font-medium zen-heading">
                                {category.name}
                            </div>
                            <div className="mt-2 flex justify-between text-xs zen-text-subtle">
                                <span>{category.count}</span>
                                <span>
                                    {formatAmount(
                                        category.amount,
                                        context.summary.currency,
                                    )}
                                </span>
                            </div>
                        </ZenSurface>
                    ),
            )}
            {budgets.map(
                (budget) =>
                    budget && (
                        <ZenSurface key={budget.id}>
                            <div className="text-sm font-medium zen-heading">
                                {budget.title}
                            </div>
                            <div className="mt-2 text-xs zen-text-subtle">
                                {formatAmount(
                                    budget.totalUsed,
                                    context.summary.currency,
                                )}{" "}
                                /{" "}
                                {formatAmount(
                                    budget.totalBudget,
                                    context.summary.currency,
                                )}
                            </div>
                            <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-black/10">
                                <div
                                    className="h-full rounded-full bg-current opacity-60"
                                    style={{
                                        width: `${Math.min(100, Math.max(0, budget.ratio * 100))}%`,
                                    }}
                                />
                            </div>
                        </ZenSurface>
                    ),
            )}
        </div>
    );
}

function ContentBlockView({
    block,
    context,
}: {
    block: ZenContentBlock;
    context: ZenContext;
}) {
    if (block.type === "entityList")
        return <EntityList block={block} context={context} />;
    if (block.type === "callout") {
        return (
            <ZenSurface
                className={cn(
                    "text-sm leading-7",
                    block.tone === "insight" && "zen-surface--accent",
                )}
            >
                {block.title && (
                    <div className="mb-2 font-medium zen-heading">
                        {block.title}
                    </div>
                )}
                <p>{block.body}</p>
            </ZenSurface>
        );
    }
    return (
        <p
            className={cn(
                "text-sm leading-8",
                block.tone === "muted" ? "zen-text-subtle" : "zen-text-muted",
            )}
        >
            {block.body}
        </p>
    );
}

function FieldLabel({ field }: { field: ZenFormField }) {
    return (
        <div>
            <label
                className="text-sm font-medium zen-heading"
                htmlFor={`zen-field-${field.id}`}
            >
                {field.label}
                {field.required && <span className="ml-1 opacity-60">*</span>}
            </label>
            {field.description && (
                <p className="mt-1 text-xs leading-5 zen-text-subtle">
                    {field.description}
                </p>
            )}
        </div>
    );
}

function FormFieldView({
    field,
    value,
    disabled,
    onChange,
}: {
    field: ZenFormField;
    value: ZenFormValue;
    disabled: boolean;
    onChange: (value: ZenFormValue) => void;
}) {
    if (field.type === "shortText" || field.type === "longText") {
        const common = {
            id: `zen-field-${field.id}`,
            value: String(value),
            disabled,
            minLength: field.minLength,
            maxLength: field.maxLength,
            placeholder: field.placeholder,
            onChange: (
                event: React.ChangeEvent<
                    HTMLInputElement | HTMLTextAreaElement
                >,
            ) => onChange(event.target.value),
            className:
                "zen-input w-full rounded-[1.25rem] p-4 text-sm leading-7 outline-none disabled:opacity-60",
        };
        return (
            <div className="space-y-3">
                <FieldLabel field={field} />
                {field.type === "longText" ? (
                    <textarea
                        {...common}
                        className={`${common.className} min-h-32 resize-none`}
                    />
                ) : (
                    <input {...common} type="text" />
                )}
            </div>
        );
    }
    if (field.type === "singleChoice" || field.type === "multiChoice") {
        const selected = Array.isArray(value)
            ? value
            : [String(value)].filter(Boolean);
        return (
            <div className="space-y-3">
                <FieldLabel field={field} />
                <div className="grid gap-2">
                    {field.options.map((option) => {
                        const active = selected.includes(option.id);
                        return (
                            <ZenOptionButton
                                key={option.id}
                                active={active}
                                disabled={disabled}
                                onClick={() => {
                                    if (field.type === "singleChoice")
                                        onChange(option.id);
                                    else
                                        onChange(
                                            active
                                                ? selected.filter(
                                                      (id) => id !== option.id,
                                                  )
                                                : [...selected, option.id],
                                        );
                                }}
                            >
                                <span className="font-medium">
                                    {option.label}
                                </span>
                                {option.description && (
                                    <span className="mt-1 block text-xs leading-5 zen-text-muted">
                                        {option.description}
                                    </span>
                                )}
                            </ZenOptionButton>
                        );
                    })}
                </div>
            </div>
        );
    }
    if (field.type === "select") {
        return (
            <div className="space-y-3">
                <FieldLabel field={field} />
                <select
                    id={`zen-field-${field.id}`}
                    value={String(value)}
                    disabled={disabled}
                    onChange={(event) => onChange(event.target.value)}
                    className="zen-input min-h-12 w-full rounded-[1.25rem] px-4 text-sm outline-none"
                >
                    <option value="">—</option>
                    {field.options.map((option) => (
                        <option key={option.id} value={option.id}>
                            {option.label}
                        </option>
                    ))}
                </select>
            </div>
        );
    }
    if (field.type === "slider") {
        const numeric = Number(value);
        const progress = Math.min(
            100,
            Math.max(
                0,
                ((numeric - field.min) / (field.max - field.min)) * 100,
            ),
        );
        const sliderStyle = {
            "--zen-slider-progress": `${progress}%`,
        } as CSSProperties;
        return (
            <div className="space-y-3">
                <FieldLabel field={field} />
                <ZenSurface>
                    <input
                        id={`zen-field-${field.id}`}
                        className="zen-range w-full"
                        type="range"
                        min={field.min}
                        max={field.max}
                        step={field.step ?? 1}
                        value={numeric}
                        style={sliderStyle}
                        disabled={disabled}
                        onChange={(event) =>
                            onChange(Number(event.target.value))
                        }
                    />
                    <div className="mt-3 text-center text-lg font-semibold zen-heading">
                        {numeric}
                    </div>
                </ZenSurface>
                <div className="flex justify-between text-xs zen-text-subtle">
                    <span>{field.minLabel}</span>
                    <span>{field.maxLabel}</span>
                </div>
            </div>
        );
    }
    if (field.type === "rating") {
        return (
            <div className="space-y-3">
                <FieldLabel field={field} />
                <div className="flex flex-wrap gap-2">
                    {Array.from(
                        { length: field.max },
                        (_, index) => index + 1,
                    ).map((rating) => (
                        <ZenButton
                            key={rating}
                            variant={
                                Number(value) === rating ? "primary" : "ghost"
                            }
                            className="size-11 min-h-11 px-0"
                            disabled={disabled}
                            onClick={() => onChange(rating)}
                        >
                            {rating}
                        </ZenButton>
                    ))}
                </div>
                <div className="flex justify-between text-xs zen-text-subtle">
                    <span>{field.lowLabel}</span>
                    <span>{field.highLabel}</span>
                </div>
            </div>
        );
    }
    return (
        <div className="flex items-center justify-between gap-4">
            <FieldLabel field={field} />
            <button
                id={`zen-field-${field.id}`}
                type="button"
                role="switch"
                aria-checked={Boolean(value)}
                disabled={disabled}
                onClick={() => onChange(!value)}
                className={cn(
                    "relative h-8 w-14 shrink-0 rounded-full transition bg-[var(--zen-btn-bg)]",
                )}
            >
                <span
                    className={cn(
                        "absolute top-1 size-6 rounded-full bg-white shadow transition",
                        value ? "left-7" : "left-1",
                    )}
                />
            </button>
        </div>
    );
}

function FormStep({
    step,
    context,
    pending,
    onSubmit,
}: {
    step: Extract<ZenUIStep, { mode: "interaction" }>;
    context: ZenContext;
    pending: boolean;
    onSubmit: (submission: ZenFormSubmission) => void;
}) {
    const [values, setValues] = useState<Record<string, ZenFormValue>>(() =>
        initialValues(step.fields),
    );
    const valid = step.fields.every((field) =>
        isFieldValid(field, values[field.id]),
    );
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <div>
                        <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                            {step.title}
                        </h2>
                        {step.description && (
                            <p className="mt-3 text-sm leading-7 zen-text-muted">
                                {step.description}
                            </p>
                        )}
                    </div>
                }
                footer={
                    <ZenActions className="pt-0">
                        {step.allowSkip && (
                            <ZenButton
                                variant="ghost"
                                disabled={pending}
                                onClick={() =>
                                    onSubmit({ action: "skip", values: {} })
                                }
                            >
                                {step.skipLabel ?? "跳过"}
                            </ZenButton>
                        )}
                        <ZenButton
                            disabled={pending || !valid}
                            onClick={() =>
                                onSubmit({ action: "submit", values })
                            }
                        >
                            {step.submitLabel}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-7">
                    {step.content.map((block, index) => (
                        <ContentBlockView
                            key={`${block.type}-${index}`}
                            block={block}
                            context={context}
                        />
                    ))}
                    {step.fields.map((field) => (
                        <FormFieldView
                            key={field.id}
                            field={field}
                            value={values[field.id] ?? defaultFieldValue(field)}
                            disabled={pending}
                            onChange={(value) =>
                                setValues((current) => ({
                                    ...current,
                                    [field.id]: value,
                                }))
                            }
                        />
                    ))}
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function CompletionStep({
    step,
    pending,
    onFinish,
    onRestart,
    onContinue,
}: {
    step: Extract<ZenUIStep, { mode: "completion" }>;
    pending: boolean;
    onFinish: () => void;
    onRestart: () => void;
    onContinue?: () => void;
}) {
    const t = useIntl();
    const { completion } = step;
    return (
        <CardShell className="zen-card--solid">
            <ZenCardLayout
                header={
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] zen-text-subtle">
                            {t("zen-completed-label")}
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-normal zen-heading">
                            {completion.title}
                        </h2>
                    </div>
                }
                footer={
                    <ZenActions className="pt-0">
                        {onContinue ? (
                            <ZenButton
                                variant="ghost"
                                disabled={pending}
                                onClick={onContinue}
                            >
                                {t("zen-explore-deeper")}
                            </ZenButton>
                        ) : (
                            <ZenButton
                                variant="ghost"
                                disabled={pending}
                                onClick={onRestart}
                            >
                                {t("zen-regenerate")}
                            </ZenButton>
                        )}
                        <ZenButton disabled={pending} onClick={onFinish}>
                            {t("zen-save-today-zen")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-6">
                    <blockquote className="zen-quote rounded-[1.6rem] p-5 text-base leading-8">
                        {completion.quote}
                    </blockquote>
                    <p className="text-sm leading-8 zen-text-muted">
                        {completion.summary}
                    </p>
                    {completion.intention && (
                        <ZenSurface className="text-sm leading-7">
                            {completion.intention}
                        </ZenSurface>
                    )}
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function CompletedView({
    post,
    pending,
    onClose,
    onRestart,
    onViewHistory,
}: {
    post: ZenPost;
    pending: boolean;
    onClose?: () => void;
    onRestart: () => void;
    onViewHistory: () => void;
}) {
    const t = useIntl();
    return (
        <CardShell className="zen-card--solid">
            <ZenCardLayout
                header={
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] zen-text-subtle">
                            {post.id}
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-normal zen-heading">
                            {post.title ?? t("zen-today-completed-title")}
                        </h2>
                    </div>
                }
                footer={
                    <ZenActions className="pt-0 flex-wrap">
                        <ZenButton variant="ghost" onClick={onViewHistory}>
                            {t("zen-view-history")}
                        </ZenButton>
                        <ZenButton
                            variant="ghost"
                            disabled={pending}
                            onClick={onRestart}
                        >
                            {t("zen-regenerate")}
                        </ZenButton>
                        <ZenButton onClick={onClose}>
                            {t("zen-close")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-6">
                    <p className="text-sm leading-7 zen-text-muted">
                        {t("zen-today-completed-hint")}
                    </p>
                    <blockquote className="zen-quote rounded-[1.6rem] p-5 text-base leading-8">
                        {post.quote}
                    </blockquote>
                    <p className="text-sm leading-8 zen-text-muted">
                        {post.summary}
                    </p>
                    {post.intention && (
                        <ZenSurface className="text-sm leading-7">
                            {post.intention}
                        </ZenSurface>
                    )}
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function LockedView({
    scheduledTime,
    onClose,
    onViewHistory,
}: {
    scheduledTime: string;
    onClose?: () => void;
    onViewHistory: () => void;
}) {
    const t = useIntl();
    return (
        <CardShell className="zen-card--solid">
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold zen-heading">
                        {t("zen-locked-title")}
                    </h2>
                }
                footer={
                    <ZenActions className="pt-0">
                        <ZenButton variant="ghost" onClick={onViewHistory}>
                            {t("zen-view-history")}
                        </ZenButton>
                        <ZenButton onClick={onClose}>
                            {t("zen-close")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <p className="text-sm leading-7 zen-text-muted">
                    {t("zen-locked-desc", { time: scheduledTime })}
                </p>
            </ZenCardLayout>
        </CardShell>
    );
}

export function ZenExperience({
    onCancel,
}: {
    onCancel?: () => void;
    onConfirm?: (v: undefined) => void;
}) {
    const t = useIntl();
    const { host, init: runtimeInit, provider, aiTools } = useZenRuntime();
    const [state, setState] = useState<ZenDialogState>({ type: "loading" });
    const [pending, setPending] = useState(false);
    const [posts, setPosts] = useState<ZenPost[]>([]);
    const [view, setView] = useState<"today" | "history">("today");
    const todayLabel = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
    const styleName = useMemo(() => getZenStyleName(), []);

    const initialize = useCallback(
        async (isCancelled: () => boolean = () => false) => {
            try {
                const { bookId, userId } = runtimeInit;
                if (!bookId) throw new Error(t("zen-select-book-first"));
                const zenDayId = getZenDayId();
                const recentZenPosts = await host.listZenPosts();
                if (isCancelled()) return;
                setPosts(recentZenPosts);
                const completed = recentZenPosts.find(
                    (post) => post.id === `zen-${zenDayId}-${userId}`,
                );
                if (completed) {
                    setState({ type: "completed", post: completed });
                    return;
                }
                const scheduledTime = runtimeInit.scheduledTime ?? "21:00";
                if (!isZenEntranceOpen(scheduledTime)) {
                    setState({ type: "locked", scheduledTime });
                    return;
                }
                const context = await host.getZenContext({ zenDayId });
                if (isCancelled()) return;
                const now = Date.now();
                const journey = createJourneyState(
                    runtimeInit.directorMode === "local",
                    context.lastZenPost,
                    now,
                );
                const session: ZenSessionState = {
                    id: zenDayId,
                    bookId,
                    userId,
                    period: context.period,
                    steps: [],
                    extractedInsights: [],
                    ...journey,
                    exploration: createZenExplorationState(),
                    status: "active",
                    createdAt: now,
                    updatedAt: now,
                };
                setState({ type: "active", session, context });
            } catch (error) {
                if (!isCancelled())
                    setState({
                        type: "error",
                        message:
                            error instanceof Error
                                ? error.message
                                : String(error),
                    });
            }
        },
        [host, runtimeInit, t],
    );

    useEffect(() => {
        let cancelled = false;
        void initialize(() => cancelled);
        return () => {
            cancelled = true;
        };
    }, [initialize]);

    const updateActive = useCallback(
        (
            current: Extract<ZenDialogState, { type: "active" }>,
            session: ZenSessionState,
            context = current.context,
        ) => setState({ ...current, context, session }),
        [],
    );

    const requestStep = useCallback(
        async (
            current: Extract<ZenDialogState, { type: "active" }>,
            session: ZenSessionState,
            lastUserInput?: unknown,
        ) => {
            setPending(true);
            try {
                const result = await requestNextZenStep({
                    session,
                    context: current.context,
                    provider,
                    hostTools: aiTools,
                    configId: runtimeInit.defaultConfigId,
                    directorMode: runtimeInit.directorMode,
                    locale: runtimeInit.locale,
                    lastUserInput,
                });
                const nextContext = result.focusDecision
                    ? await host.getZenContext({
                          zenDayId: session.id,
                          focusDecision: result.focusDecision,
                      })
                    : current.context;
                const nextSession: ZenSessionState = {
                    ...session,
                    period: nextContext.period,
                    focusDecision: nextContext.focusDecision,
                    currentStep: result.step,
                    history: result.history,
                    sentContextSignature: result.sentContextSignature,
                    exploration: mergeDirectorState(
                        session.exploration,
                        result.step,
                    ),
                    extractedInsights: result.step.directorState?.insightSummary
                        ? [
                              ...session.extractedInsights.filter(
                                  (item) =>
                                      item.text !==
                                      result.step.directorState?.insightSummary,
                              ),
                              {
                                  id: `insight-${result.step.stepId}`,
                                  text: result.step.directorState
                                      .insightSummary,
                              },
                          ]
                        : session.extractedInsights,
                    updatedAt: Date.now(),
                };
                updateActive(current, nextSession, nextContext);
            } catch (error) {
                setState({
                    type: "error",
                    message:
                        error instanceof Error ? error.message : String(error),
                });
            } finally {
                setPending(false);
            }
        },
        [aiTools, host, provider, runtimeInit, updateActive],
    );

    const restartZen = useCallback(async () => {
        setPending(true);
        try {
            const { bookId, userId } = runtimeInit;
            if (!bookId) throw new Error(t("zen-select-book-first"));
            const zenDayId = getZenDayId();
            const context = await host.getZenContext({ zenDayId });
            const now = Date.now();
            const journey = createJourneyState(
                runtimeInit.directorMode === "local",
                context.lastZenPost,
                now,
            );
            setState({
                type: "active",
                context,
                session: {
                    id: zenDayId,
                    bookId,
                    userId,
                    period: context.period,
                    steps: [],
                    extractedInsights: [],
                    ...journey,
                    exploration: createZenExplorationState(),
                    status: "active",
                    createdAt: now,
                    updatedAt: now,
                },
            });
        } catch (error) {
            setState({
                type: "error",
                message: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setPending(false);
        }
    }, [host, runtimeInit, t]);

    useEffect(() => {
        if (state.type === "active" && !state.session.currentStep && !pending)
            void requestStep(state, state.session);
    }, [pending, requestStep, state]);

    const submitInteraction = useCallback(
        async (submission: ZenFormSubmission) => {
            if (
                state.type !== "active" ||
                state.session.currentStep?.mode !== "interaction"
            )
                return;
            const record = createSessionStep(
                state.session.currentStep,
                submission,
                state.context,
            );
            const nextSession: ZenSessionState = {
                ...state.session,
                steps: [...state.session.steps, record],
                exploration: recordZenResponse(
                    state.session.exploration,
                    submission,
                ),
                updatedAt: Date.now(),
            };
            updateActive(state, nextSession);
            await requestStep(state, nextSession, submission);
        },
        [requestStep, state, updateActive],
    );

    const finishZen = useCallback(async () => {
        if (
            state.type !== "active" ||
            state.session.currentStep?.mode !== "completion"
        )
            return;
        setPending(true);
        try {
            const post = buildZenPost(state.session, state.session.currentStep);
            await host.mutateZenPosts({
                mutations: [{ type: "upsert", post }],
            });
            setPosts(await host.listZenPosts());
            setState({ type: "completed", post });
        } finally {
            setPending(false);
        }
    }, [host, state]);

    const forgetZenPost = useCallback(
        async (post: ZenPost) => {
            await host.mutateZenPosts({
                mutations: [{ type: "delete", id: post.id }],
            });
            const nextPosts = await host.listZenPosts();
            setPosts(nextPosts);
            const todayId = `zen-${getZenDayId()}-${runtimeInit.userId}`;
            if (post.id === todayId) {
                setView("today");
                setState({ type: "loading" });
                await initialize();
            }
        },
        [host, initialize, runtimeInit.userId],
    );

    const continueDeeper = useCallback(async () => {
        if (state.type !== "active" || state.session.journeyPlan.extensionUsed)
            return;
        const nextSession: ZenSessionState = {
            ...state.session,
            journeyPlan: extendZenJourney(state.session.journeyPlan),
            currentStep: undefined,
            updatedAt: Date.now(),
        };
        updateActive(state, nextSession);
        await requestStep(state, nextSession, {
            action: "continue_deeper",
            values: {},
        });
    }, [requestStep, state, updateActive]);

    const activeStep =
        state.type === "active" ? state.session.currentStep : undefined;
    const activeContext = state.type === "active" ? state.context : undefined;
    const isBackgroundFocused =
        pending ||
        state.type === "loading" ||
        (state.type === "active" && !activeStep);
    if (view === "history")
        return (
            <ZenPostsView
                posts={posts}
                onCancel={() => setView("today")}
                onForget={forgetZenPost}
            />
        );

    return (
        <div
            data-status={pending ? "loading" : "ready"}
            className={cn(
                "zen-root zen-text zen-gradient-drift relative h-full overflow-hidden",
                `zen-style-${styleName}`,
                isBackgroundFocused && "zen-gradient-focus",
            )}
        >
            <div className="zen-overlay pointer-events-none absolute inset-0" />
            <ZenBackdropFx styleName={styleName} />
            <div className="relative mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-5 px-4 pt-[max(var(--safe-area-inset-top),20px)] pb-[max(var(--safe-area-inset-bottom),20px)] sm:px-6 sm:py-7">
                <div className="zen-header-bar flex shrink-0 items-center justify-between gap-3 rounded-full px-3 py-2">
                    <div>
                        <div className="text-xs uppercase tracking-[0.2em] zen-text-muted">
                            {t("zen-header-label")}
                        </div>
                        <div className="text-sm zen-text-subtle">
                            {todayLabel}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="zen-close-btn grid size-11 place-items-center rounded-full transition"
                        onClick={onCancel}
                    >
                        <i className="icon-[mdi--close] size-5" />
                    </button>
                </div>
                {state.type === "loading" && (
                    <CardShell className="min-h-72">
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-sm zen-text-muted">
                            <div className="zen-surface rounded-full p-4 backdrop-blur-xl">
                                <Loading className="[&_i]:size-6" />
                            </div>
                            <div>{t("zen-loading-open")}</div>
                        </div>
                    </CardShell>
                )}
                {state.type === "error" && (
                    <CardShell>
                        <ZenCardLayout
                            header={
                                <h2 className="text-2xl font-semibold zen-heading">
                                    {t("zen-error-title")}
                                </h2>
                            }
                            footer={
                                <ZenActions className="pt-0">
                                    <ZenButton onClick={onCancel}>
                                        {t("zen-close")}
                                    </ZenButton>
                                </ZenActions>
                            }
                        >
                            <p className="text-sm leading-7 zen-text-muted">
                                {state.message}
                            </p>
                        </ZenCardLayout>
                    </CardShell>
                )}
                {state.type === "locked" && (
                    <LockedView
                        scheduledTime={state.scheduledTime}
                        onClose={onCancel}
                        onViewHistory={() => setView("history")}
                    />
                )}
                {state.type === "completed" && (
                    <CompletedView
                        post={state.post}
                        pending={pending}
                        onClose={onCancel}
                        onRestart={restartZen}
                        onViewHistory={() => setView("history")}
                    />
                )}
                {state.type === "active" && !activeStep && (
                    <CardShell>
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center zen-text-muted">
                            <div className="text-2xl font-medium">
                                {t("zen-loading-period")}
                            </div>
                            <div className="text-sm">
                                {t("zen-loading-period-desc-1")}
                            </div>
                        </div>
                    </CardShell>
                )}
                {activeStep?.mode === "interaction" && activeContext && (
                    <FormStep
                        key={activeStep.stepId}
                        step={activeStep}
                        context={activeContext}
                        pending={pending}
                        onSubmit={submitInteraction}
                    />
                )}
                {activeStep?.mode === "completion" && (
                    <CompletionStep
                        step={activeStep}
                        pending={pending}
                        onFinish={finishZen}
                        onRestart={restartZen}
                        onContinue={
                            state.type === "active" &&
                            runtimeInit.directorMode === "ai" &&
                            !state.session.journeyPlan.extensionUsed
                                ? continueDeeper
                                : undefined
                        }
                    />
                )}
            </div>
        </div>
    );
}
