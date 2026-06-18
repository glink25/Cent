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
import { toast } from "sonner";
import createConfirmProvider from "@/components/confirm";
import Loading from "@/components/loading";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { buildZenContext } from "./analyzer";
import { getZenDayId, getZenSessionKey, getZenStyleIndex } from "./date";
import { requestNextZenStep } from "./director";
import { createFallbackEpilogueStep } from "./fallback";
import { getPersonalZenPosts, getZenPostById, upsertZenPost } from "./posts";
import {
    deleteZenSession,
    getZenSession,
    putZenSession,
} from "./session-storage";
import type {
    BillFocusCard,
    BudgetAdjustCard,
    ChoiceCard,
    FreeInputCard,
    InsightTextCard,
    IntentionCard,
    ShredderCard,
    SliderCard,
    ThemeSelectorCard,
    ZenComponent,
    ZenContext,
    ZenEpilogueCard,
    ZenPost,
    ZenSessionState,
    ZenUIStep,
} from "./types";

type ZenDialogState =
    | { type: "loading" }
    | { type: "error"; message: string }
    | { type: "completed"; post: ZenPost }
    | {
          type: "active";
          session: ZenSessionState;
          context: ZenContext;
          key: string;
      };

function cardSummary(component: ZenComponent, userInput: unknown) {
    if (component.type === "ThemeSelectorCard") {
        return `选择主题：${String(userInput || "")}`;
    }
    if (component.type === "SliderCard") {
        return `${component.title}：${String(userInput)}`;
    }
    if (component.type === "FreeInputCard") {
        return `${component.title}：${String(userInput || "跳过")}`;
    }
    if (component.type === "BillFocusCard") {
        return `${component.title}：${String(userInput || "看过")}`;
    }
    if (component.type === "ChoiceCard") {
        const value = Array.isArray(userInput)
            ? userInput.join("、")
            : String(userInput || "跳过");
        return `${component.title}：${value}`;
    }
    if (component.type === "ShredderCard") {
        return `${component.title}：${JSON.stringify(userInput)}`;
    }
    if (component.type === "BudgetAdjustCard") {
        return `${component.title}：${String(userInput || "观察")}`;
    }
    if (component.type === "IntentionCard") {
        return `${component.title}：${String(userInput || "跳过")}`;
    }
    return component.title;
}

function createSessionStep(step: ZenUIStep, userInput: unknown) {
    return {
        stepId: step.stepId,
        componentType: step.component.type,
        aiPromptSummary: cardSummary(step.component, userInput),
        userInput,
        relatedBillIds:
            step.dataBindings?.billIds ??
            (step.component.type === "BillFocusCard"
                ? step.component.billIds
                : undefined),
        relatedCategoryIds: step.dataBindings?.categoryIds,
        createdAt: Date.now(),
    };
}

function buildZenPost(session: ZenSessionState, epilogue: ZenUIStep): ZenPost {
    const component: ZenEpilogueCard =
        epilogue.component.type === "ZenEpilogueCard"
            ? epilogue.component
            : (createFallbackEpilogueStep(session)
                  .component as ZenEpilogueCard);
    const now = Date.now();
    const userId = session.userId;
    return {
        id: `zen-${session.id}-${userId}`,
        userId,
        time: session.period.start,
        bookId: session.bookId,
        period: session.period,
        mood: session.mood,
        theme: session.selectedTheme,
        summary: component.summary,
        quote: component.quote,
        intention: component.intention ?? session.finalIntention?.text,
        cardSummaries: session.steps.map((step) => step.aiPromptSummary),
        tags: session.selectedTheme?.tags ?? [],
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
                "zen-card zen-card-enter relative flex min-h-0 flex-1 overflow-hidden rounded-[2rem]",
                className,
            )}
        >
            <div className="relative flex min-h-0 flex-1 flex-col">
                {children}
            </div>
        </div>
    );
}

function ZenCardLayout({
    header,
    children,
    footer,
    bodyClassName,
}: {
    header: ReactNode;
    children: ReactNode;
    footer?: ReactNode;
    bodyClassName?: string;
}) {
    return (
        <>
            <div className="shrink-0 p-5 pb-4 sm:p-7 sm:pb-5">{header}</div>
            <div
                className={cn(
                    "min-h-0 flex-1 overflow-y-auto px-5 pb-5 sm:px-7 sm:pb-7",
                    footer && "pb-4 sm:pb-5",
                    bodyClassName,
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
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    active?: boolean;
}) {
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

function formatZenAmount(amount: number, currency: string) {
    return `${amount.toFixed(2)} ${currency}`;
}

function resolveBoundBills(cardBillIds: string[], context: ZenContext) {
    const billMap = new Map(
        context.candidateBills.map((bill) => [bill.id, bill]),
    );
    return cardBillIds
        .map((id) => billMap.get(id))
        .filter((bill): bill is ZenContext["candidateBills"][number] =>
            Boolean(bill),
        );
}

function ThemeSelector({
    card,
    pending,
    onSubmit,
}: {
    card: ThemeSelectorCard;
    pending: boolean;
    onSubmit: (value: string) => void;
}) {
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
            >
                <div className="space-y-6">
                    {card.subtitle && (
                        <p className="mt-3 text-sm leading-7 zen-text-muted">
                            {card.subtitle}
                        </p>
                    )}
                    <div className="grid gap-3">
                        {card.options.map((option) => (
                            <ZenOptionButton
                                key={option.id}
                                active={option.id === card.recommendedOptionId}
                                disabled={pending}
                                onClick={() => onSubmit(option.id)}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="font-medium leading-6">
                                        {option.title}
                                    </div>
                                    {option.id === card.recommendedOptionId && (
                                        <span className="zen-badge shrink-0 rounded-full px-2.5 py-1 text-[11px] shadow-sm">
                                            Zen
                                        </span>
                                    )}
                                </div>
                                {option.subtitle && (
                                    <div className="mt-2 text-sm leading-6 zen-text-muted">
                                        {option.subtitle}
                                    </div>
                                )}
                            </ZenOptionButton>
                        ))}
                    </div>
                    {card.reason && (
                        <p className="text-xs leading-5 zen-text-subtle">
                            {card.reason}
                        </p>
                    )}
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function BillFocusCardView({
    card,
    context,
    pending,
    onSubmit,
}: {
    card: BillFocusCard;
    context: ZenContext;
    pending: boolean;
    onSubmit: (value?: unknown) => void;
}) {
    const t = useIntl();
    const bills = resolveBoundBills(card.billIds, context);
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
                footer={
                    <ZenActions className="pt-0">
                        <ZenButton
                            variant="ghost"
                            disabled={pending}
                            onClick={() => onSubmit("skip")}
                        >
                            {t("zen-skip")}
                        </ZenButton>
                        <ZenButton
                            disabled={pending}
                            onClick={() => onSubmit("seen")}
                        >
                            {t("zen-continue")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-6">
                    {card.description && (
                        <p className="mt-3 text-sm leading-7 zen-text-muted">
                            {card.description}
                        </p>
                    )}
                    <div className="grid gap-3">
                        {bills.length > 0 ? (
                            bills.map((bill) => (
                                <ZenSurface key={bill.id}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="zen-heading truncate text-sm font-medium">
                                                {bill.categoryName}
                                            </div>
                                            <div className="mt-1 text-xs zen-text-subtle">
                                                {dayjs(bill.time).format(
                                                    "YYYY-MM-DD",
                                                )}
                                            </div>
                                        </div>
                                        <div className="zen-chip shrink-0 rounded-full px-3 py-1 text-sm font-semibold">
                                            {formatZenAmount(
                                                bill.amount,
                                                context.summary.currency,
                                            )}
                                        </div>
                                    </div>
                                    {bill.comment && (
                                        <div className="mt-3 text-xs leading-5 zen-text-subtle">
                                            {bill.comment}
                                        </div>
                                    )}
                                </ZenSurface>
                            ))
                        ) : (
                            <ZenSurface className="text-sm leading-6 zen-text-muted">
                                {t("zen-bill-focus-empty")}
                            </ZenSurface>
                        )}
                    </div>
                    {card.question && (
                        <p className="zen-surface zen-surface--accent rounded-[1.25rem] p-4 text-sm leading-7">
                            {card.question}
                        </p>
                    )}
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function ChoiceCardView({
    card,
    pending,
    onSubmit,
}: {
    card: ChoiceCard;
    pending: boolean;
    onSubmit: (value: string | string[]) => void;
}) {
    const t = useIntl();
    const [selected, setSelected] = useState<string[]>([]);
    const toggle = (id: string) => {
        if (card.allowMultiple) {
            setSelected((prev) =>
                prev.includes(id)
                    ? prev.filter((item) => item !== id)
                    : [...prev, id],
            );
            return;
        }
        setSelected([id]);
    };
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
                footer={
                    <ZenActions className="pt-0">
                        {card.allowSkip && (
                            <ZenButton
                                variant="ghost"
                                disabled={pending}
                                onClick={() => onSubmit("skip")}
                            >
                                {t("zen-skip")}
                            </ZenButton>
                        )}
                        <ZenButton
                            disabled={pending || selected.length === 0}
                            onClick={() =>
                                onSubmit(
                                    card.allowMultiple ? selected : selected[0],
                                )
                            }
                        >
                            {t("zen-continue")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-6">
                    {card.description && (
                        <p className="mt-3 text-sm leading-7 zen-text-muted">
                            {card.description}
                        </p>
                    )}
                    <div className="grid gap-3">
                        {card.options.map((option) => {
                            const active = selected.includes(option.id);
                            return (
                                <ZenOptionButton
                                    key={option.id}
                                    disabled={pending}
                                    active={active}
                                    onClick={() => toggle(option.id)}
                                >
                                    <div className="font-medium leading-6">
                                        {option.label}
                                    </div>
                                    {option.description && (
                                        <div className="mt-2 text-sm leading-6 zen-text-muted">
                                            {option.description}
                                        </div>
                                    )}
                                </ZenOptionButton>
                            );
                        })}
                    </div>
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function InsightCard({
    card,
    pending,
    onSubmit,
}: {
    card: InsightTextCard;
    pending: boolean;
    onSubmit: (value?: unknown) => void;
}) {
    const t = useIntl();
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
                footer={
                    <ZenActions className="pt-0">
                        <ZenButton
                            variant="ghost"
                            disabled={pending}
                            onClick={() => onSubmit("skip")}
                        >
                            {t("zen-skip")}
                        </ZenButton>
                        <ZenButton
                            disabled={pending}
                            onClick={() => onSubmit("continue")}
                        >
                            {t("zen-continue")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div>
                    <p className="zen-surface zen-text-muted mt-4 rounded-[1.5rem] p-5 text-sm leading-8">
                        {card.body}
                    </p>
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function ShredderCardView({
    card,
    pending,
    onSubmit,
}: {
    card: ShredderCard;
    pending: boolean;
    onSubmit: (value: Record<string, string>) => void;
}) {
    const t = useIntl();
    const [choices, setChoices] = useState<Record<string, string>>({});
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
                footer={
                    <ZenActions className="pt-0">
                        <ZenButton
                            variant="ghost"
                            disabled={pending}
                            onClick={() => onSubmit({})}
                        >
                            {t("zen-skip")}
                        </ZenButton>
                        <ZenButton
                            disabled={
                                pending ||
                                Object.keys(choices).length < card.items.length
                            }
                            onClick={() => onSubmit(choices)}
                        >
                            {t("zen-continue")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-6">
                    <p className="mt-3 text-sm leading-7 zen-text-muted">
                        {t("zen-shredder-helper")}
                    </p>
                </div>
                <div className="grid gap-3">
                    {card.items.map((item) => (
                        <ZenSurface key={item.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="zen-heading truncate text-sm font-medium">
                                        {item.label}
                                    </div>
                                    {(item.description ||
                                        item.categoryName) && (
                                        <div className="mt-2 text-xs leading-5 zen-text-subtle">
                                            {item.description ??
                                                item.categoryName}
                                        </div>
                                    )}
                                </div>
                                {typeof item.amount === "number" && (
                                    <div className="zen-chip shrink-0 rounded-full px-3 py-1 text-sm font-semibold">
                                        {item.amount.toFixed(2)}
                                    </div>
                                )}
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                                {card.actions.map((action) => (
                                    <ZenButton
                                        key={action}
                                        variant={
                                            choices[item.id] === action
                                                ? "primary"
                                                : "ghost"
                                        }
                                        className="min-h-10 px-3 text-xs"
                                        disabled={pending}
                                        onClick={() =>
                                            setChoices((prev) => ({
                                                ...prev,
                                                [item.id]: action,
                                            }))
                                        }
                                    >
                                        {t(`zen-shredder-action-${action}`)}
                                    </ZenButton>
                                ))}
                            </div>
                        </ZenSurface>
                    ))}
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function SliderCardView({
    card,
    pending,
    onSubmit,
}: {
    card: SliderCard;
    pending: boolean;
    onSubmit: (value: number) => void;
}) {
    const t = useIntl();
    const [value, setValue] = useState(card.defaultValue);
    const sliderProgress =
        card.maxValue === card.minValue
            ? 50
            : ((value - card.minValue) / (card.maxValue - card.minValue)) * 100;
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
                footer={
                    <ZenActions className="pt-0">
                        <ZenButton
                            disabled={pending}
                            onClick={() => onSubmit(value)}
                        >
                            {t("zen-place-here")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-7">
                    {card.description && (
                        <p className="mt-3 text-sm leading-7 zen-text-muted">
                            {card.description}
                        </p>
                    )}
                </div>
                <div className="space-y-4">
                    <div className="zen-surface rounded-[1.5rem] px-4 py-5">
                        <input
                            type="range"
                            min={card.minValue}
                            max={card.maxValue}
                            value={value}
                            disabled={pending}
                            onChange={(event) =>
                                setValue(Number(event.target.value))
                            }
                            style={
                                {
                                    "--zen-slider-progress": `${sliderProgress}%`,
                                } as CSSProperties
                            }
                            className="zen-range w-full"
                        />
                    </div>
                    <div className="flex justify-between gap-4 text-xs leading-5 zen-text-subtle">
                        <span>{card.minLabel}</span>
                        <span className="text-right">{card.maxLabel}</span>
                    </div>
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function BudgetAdjustCardView({
    card,
    context,
    pending,
    onSubmit,
}: {
    card: BudgetAdjustCard;
    context: ZenContext;
    pending: boolean;
    onSubmit: (value: string) => void;
}) {
    const t = useIntl();
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
                footer={
                    <ZenActions className="pt-0">
                        <ZenButton
                            variant="ghost"
                            disabled={pending}
                            onClick={() => onSubmit("observe")}
                        >
                            {t("zen-budget-observe")}
                        </ZenButton>
                        <ZenButton
                            disabled={pending}
                            onClick={() => onSubmit("noted")}
                        >
                            {card.confirmAction}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-6">
                    <p className="mt-3 text-sm leading-7 zen-text-muted">
                        {card.reason}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ZenSurface>
                            <div className="text-xs zen-text-subtle">
                                {t("zen-budget-current")}
                            </div>
                            <div className="mt-2 text-lg font-semibold zen-heading">
                                {formatZenAmount(
                                    card.currentBudget,
                                    context.summary.currency,
                                )}
                            </div>
                        </ZenSurface>
                        <ZenSurface>
                            <div className="text-xs zen-text-subtle">
                                {t("zen-budget-used")}
                            </div>
                            <div className="mt-2 text-lg font-semibold zen-heading">
                                {formatZenAmount(
                                    card.currentUsed ?? 0,
                                    context.summary.currency,
                                )}
                            </div>
                        </ZenSurface>
                        <ZenSurface className="zen-surface--accent">
                            <div className="text-xs zen-text-subtle">
                                {t("zen-budget-suggested")}
                            </div>
                            <div className="mt-2 text-lg font-semibold zen-heading">
                                {formatZenAmount(
                                    card.suggestedBudget,
                                    context.summary.currency,
                                )}
                            </div>
                        </ZenSurface>
                    </div>
                    {card.categoryName && (
                        <ZenSurface className="text-sm leading-6">
                            {card.categoryName}
                        </ZenSurface>
                    )}
                    <p className="text-xs leading-5 zen-text-subtle">
                        {t("zen-budget-non-mutating-hint")}
                    </p>
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function FreeInputCardView({
    card,
    pending,
    onSubmit,
}: {
    card: FreeInputCard;
    pending: boolean;
    onSubmit: (value: string) => void;
}) {
    const t = useIntl();
    const [value, setValue] = useState("");
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
                footer={
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs zen-text-subtle">
                            {value.length}/{card.maxLength}
                        </span>
                        <ZenActions className="pt-0">
                            <ZenButton
                                variant="ghost"
                                disabled={pending}
                                onClick={() => onSubmit("")}
                            >
                                {t("zen-skip")}
                            </ZenButton>
                            <ZenButton
                                disabled={pending}
                                onClick={() => onSubmit(value)}
                            >
                                {t("zen-continue")}
                            </ZenButton>
                        </ZenActions>
                    </div>
                }
            >
                <div className="space-y-5">
                    {card.helperText && (
                        <p className="mt-3 text-sm leading-7 zen-text-muted">
                            {card.helperText}
                        </p>
                    )}
                    <textarea
                        value={value}
                        disabled={pending}
                        maxLength={card.maxLength}
                        placeholder={card.placeholder}
                        onChange={(event) => setValue(event.target.value)}
                        className="min-h-36 zen-input w-full resize-none rounded-[1.5rem] p-5 text-sm leading-7 backdrop-blur-2xl outline-none disabled:opacity-60"
                    />
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function IntentionCardView({
    card,
    pending,
    onSubmit,
}: {
    card: IntentionCard;
    pending: boolean;
    onSubmit: (value: string) => void;
}) {
    const t = useIntl();
    const [selected, setSelected] = useState("");
    const [custom, setCustom] = useState("");
    const value = custom.trim() || selected;
    return (
        <CardShell>
            <ZenCardLayout
                header={
                    <h2 className="text-2xl font-semibold tracking-normal zen-heading">
                        {card.title}
                    </h2>
                }
                footer={
                    <ZenActions className="pt-0">
                        <ZenButton
                            variant="ghost"
                            disabled={pending}
                            onClick={() => onSubmit("")}
                        >
                            {t("zen-skip")}
                        </ZenButton>
                        <ZenButton
                            disabled={pending || !value}
                            onClick={() => onSubmit(value)}
                        >
                            {t("zen-continue")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-6">
                    <p className="mt-3 text-sm leading-7 zen-text-muted">
                        {t("zen-intention-helper")}
                    </p>
                    <div className="grid gap-3">
                        {card.suggestions.map((suggestion) => (
                            <ZenOptionButton
                                key={suggestion}
                                disabled={pending}
                                active={
                                    selected === suggestion && !custom.trim()
                                }
                                onClick={() => {
                                    setSelected(suggestion);
                                    setCustom("");
                                }}
                            >
                                {suggestion}
                            </ZenOptionButton>
                        ))}
                    </div>
                    {card.customInputEnabled && (
                        <textarea
                            value={custom}
                            disabled={pending}
                            maxLength={160}
                            placeholder={t("zen-intention-placeholder")}
                            onChange={(event) => setCustom(event.target.value)}
                            className="min-h-28 zen-input w-full resize-none rounded-[1.5rem] p-5 text-sm leading-7 backdrop-blur-2xl outline-none disabled:opacity-60"
                        />
                    )}
                </div>
            </ZenCardLayout>
        </CardShell>
    );
}

function Epilogue({
    step,
    pending,
    onFinish,
    onRestart,
}: {
    step: ZenUIStep;
    pending: boolean;
    onFinish: () => void;
    onRestart: () => void;
}) {
    const t = useIntl();
    const card =
        step.component.type === "ZenEpilogueCard" ? step.component : undefined;
    if (!card) return null;
    return (
        <CardShell className="zen-card--solid">
            <ZenCardLayout
                header={
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] zen-text-subtle">
                            {t("zen-completed-label")}
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-normal zen-heading">
                            {card.title}
                        </h2>
                    </div>
                }
                footer={
                    <ZenActions className="pt-0">
                        <ZenButton
                            variant="ghost"
                            disabled={pending}
                            onClick={onRestart}
                        >
                            {t("zen-regenerate")}
                        </ZenButton>
                        <ZenButton disabled={pending} onClick={onFinish}>
                            {t("zen-save-today-zen")}
                        </ZenButton>
                    </ZenActions>
                }
            >
                <div className="space-y-6">
                    <blockquote className="zen-quote rounded-[1.6rem] p-5 text-base leading-8">
                        {card.quote}
                    </blockquote>
                    <p className="text-sm leading-8 zen-text-muted">
                        {card.summary}
                    </p>
                    {card.intention && (
                        <ZenSurface className="text-sm leading-7">
                            {card.intention}
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
}: {
    post: ZenPost;
    pending: boolean;
    onClose?: () => void;
    onRestart: () => void;
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
                            {t("zen-today-completed-title")}
                        </h2>
                    </div>
                }
                footer={
                    <ZenActions className="pt-0">
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
                    {post.theme && (
                        <ZenSurface className="text-sm leading-6">
                            {post.theme.title}
                        </ZenSurface>
                    )}
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

function ZenDialogForm({
    onCancel,
}: {
    onCancel?: () => void;
    onConfirm?: (v: undefined) => void;
}) {
    const t = useIntl();
    const [state, setState] = useState<ZenDialogState>({ type: "loading" });
    const [pending, setPending] = useState(false);
    const todayLabel = useMemo(() => dayjs().format("YYYY-MM-DD"), []);
    const styleIndex = useMemo(() => getZenStyleIndex(), []);

    useEffect(() => {
        let cancelled = false;
        async function init() {
            try {
                const bookId = useBookStore.getState().currentBookId;
                const userId = useUserStore.getState().id;
                if (!bookId) {
                    throw new Error(t("zen-select-book-first"));
                }
                const zenDayId = getZenDayId();
                const bills = await useLedgerStore.getState().refreshBillList();
                const meta = useLedgerStore.getState().infos?.meta;
                const completed = getZenPostById(zenDayId);
                if (completed) {
                    if (!cancelled) {
                        setState({ type: "completed", post: completed });
                    }
                    return;
                }

                const key = getZenSessionKey({
                    bookId,
                    userId,
                    zenDayId,
                });
                const recentZenPosts = getPersonalZenPosts();
                const restored = await getZenSession(key);
                const context = buildZenContext({
                    zenDayId,
                    bills,
                    meta,
                    recentZenPosts,
                    focusDecision: restored?.focusDecision,
                });
                const now = Date.now();
                const session: ZenSessionState =
                    restored?.status === "active"
                        ? restored
                        : {
                              id: zenDayId,
                              bookId,
                              userId,
                              period: context.period,
                              steps: [],
                              extractedInsights: [],
                              status: "active",
                              createdAt: now,
                              updatedAt: now,
                          };
                if (!restored) {
                    await putZenSession(key, session);
                }
                if (!cancelled) {
                    setState({ type: "active", session, context, key });
                }
            } catch (error) {
                const message =
                    error instanceof Error ? error.message : String(error);
                if (!cancelled) {
                    setState({ type: "error", message });
                }
            }
        }
        void init();
        return () => {
            cancelled = true;
        };
    }, [t]);

    const updateActive = useCallback(
        async (
            current: Extract<ZenDialogState, { type: "active" }>,
            session: ZenSessionState,
            context = current.context,
        ) => {
            await putZenSession(current.key, session);
            setState({ ...current, context, session });
        },
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
                const { step, history, focusDecision } =
                    await requestNextZenStep({
                        session,
                        context: current.context,
                        lastUserInput,
                    });
                const nextContext = focusDecision
                    ? buildZenContext({
                          zenDayId: session.id,
                          bills: useLedgerStore.getState().bills,
                          meta: useLedgerStore.getState().infos?.meta,
                          recentZenPosts: getPersonalZenPosts(),
                          focusDecision,
                      })
                    : current.context;
                const nextSession: ZenSessionState = {
                    ...session,
                    period: nextContext.period,
                    focusDecision: nextContext.focusDecision,
                    currentStep: step,
                    history,
                    updatedAt: Date.now(),
                };
                await updateActive(current, nextSession, nextContext);
            } finally {
                setPending(false);
            }
        },
        [updateActive],
    );

    const restartZen = useCallback(async () => {
        setPending(true);
        try {
            const bookId = useBookStore.getState().currentBookId;
            const userId = useUserStore.getState().id;
            if (!bookId) {
                throw new Error("请先选择一个账本");
            }
            const zenDayId = getZenDayId();
            const key = getZenSessionKey({
                bookId,
                userId,
                zenDayId,
            });
            await deleteZenSession(key);

            const bills = await useLedgerStore.getState().refreshBillList();
            const meta = useLedgerStore.getState().infos?.meta;
            const context = buildZenContext({
                zenDayId,
                bills,
                meta,
                recentZenPosts: getPersonalZenPosts(),
            });
            const now = Date.now();
            const session: ZenSessionState = {
                id: zenDayId,
                bookId,
                userId,
                period: context.period,
                steps: [],
                extractedInsights: [],
                status: "active",
                createdAt: now,
                updatedAt: now,
            };
            await putZenSession(key, session);
            setState({ type: "active", session, context, key });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            setState({ type: "error", message });
        } finally {
            setPending(false);
        }
    }, []);

    useEffect(() => {
        if (state.type !== "active" || state.session.currentStep || pending) {
            return;
        }
        void requestStep(state, state.session);
    }, [pending, requestStep, state]);

    const submitStep = useCallback(
        async (userInput: unknown) => {
            if (state.type !== "active" || !state.session.currentStep) return;
            const { currentStep } = state.session;
            if (currentStep.component.type === "ZenEpilogueCard") {
                setPending(true);
                try {
                    const post = buildZenPost(state.session, currentStep);
                    await upsertZenPost(post);
                    await deleteZenSession(state.key);
                    setState({ type: "completed", post });
                    toast.success(t("zen-saved-toast"));
                } finally {
                    setPending(false);
                }
                return;
            }

            const newStep = createSessionStep(currentStep, userInput);
            let selectedTheme = state.session.selectedTheme;
            let finalIntention = state.session.finalIntention;
            if (currentStep.component.type === "ThemeSelectorCard") {
                const card = currentStep.component;
                selectedTheme =
                    card.options.find((option) => option.id === userInput) ??
                    card.options.find(
                        (option) => option.id === card.recommendedOptionId,
                    ) ??
                    card.options[0];
            }
            if (
                currentStep.component.type === "IntentionCard" &&
                typeof userInput === "string" &&
                userInput.trim()
            ) {
                finalIntention = {
                    text: userInput.trim(),
                    duration:
                        currentStep.component.duration === "day"
                            ? "day"
                            : "week",
                };
            }
            const nextSession: ZenSessionState = {
                ...state.session,
                selectedTheme,
                finalIntention,
                steps: [...state.session.steps, newStep],
                updatedAt: Date.now(),
            };
            await updateActive(state, nextSession);
            await requestStep(state, nextSession, userInput);
        },
        [requestStep, state, updateActive, t],
    );

    const activeStep =
        state.type === "active" ? state.session.currentStep : undefined;
    const activeContext = state.type === "active" ? state.context : undefined;
    const isBackgroundFocused =
        pending ||
        state.type === "loading" ||
        (state.type === "active" && !activeStep);

    return (
        <div
            data-status={pending ? "loading" : "ready"}
            className={cn(
                "zen-root zen-text zen-gradient-drift relative h-full overflow-hidden",
                `zen-style-${styleIndex}`,
                isBackgroundFocused && "zen-gradient-focus",
            )}
        >
            <div className="zen-overlay pointer-events-none absolute inset-0" />
            <div className="relative mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7">
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
                        <i className="icon-[mdi--close] size-5"></i>
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

                {state.type === "completed" && (
                    <CompletedView
                        post={state.post}
                        pending={pending}
                        onClose={onCancel}
                        onRestart={restartZen}
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

                {activeStep?.component.type === "ThemeSelectorCard" && (
                    <ThemeSelector
                        card={activeStep.component}
                        pending={pending}
                        onSubmit={submitStep}
                    />
                )}

                {activeStep?.component.type === "BillFocusCard" &&
                    activeContext && (
                        <BillFocusCardView
                            card={activeStep.component}
                            context={activeContext}
                            pending={pending}
                            onSubmit={submitStep}
                        />
                    )}

                {activeStep?.component.type === "ChoiceCard" && (
                    <ChoiceCardView
                        card={activeStep.component}
                        pending={pending}
                        onSubmit={submitStep}
                    />
                )}

                {activeStep?.component.type === "InsightTextCard" && (
                    <InsightCard
                        card={activeStep.component}
                        pending={pending}
                        onSubmit={submitStep}
                    />
                )}

                {activeStep?.component.type === "ShredderCard" && (
                    <ShredderCardView
                        card={activeStep.component}
                        pending={pending}
                        onSubmit={submitStep}
                    />
                )}

                {activeStep?.component.type === "SliderCard" && (
                    <SliderCardView
                        card={activeStep.component}
                        pending={pending}
                        onSubmit={submitStep}
                    />
                )}

                {activeStep?.component.type === "BudgetAdjustCard" &&
                    activeContext && (
                        <BudgetAdjustCardView
                            card={activeStep.component}
                            context={activeContext}
                            pending={pending}
                            onSubmit={submitStep}
                        />
                    )}

                {activeStep?.component.type === "FreeInputCard" && (
                    <FreeInputCardView
                        card={activeStep.component}
                        pending={pending}
                        onSubmit={submitStep}
                    />
                )}

                {activeStep?.component.type === "IntentionCard" && (
                    <IntentionCardView
                        card={activeStep.component}
                        pending={pending}
                        onSubmit={submitStep}
                    />
                )}

                {activeStep?.component.type === "ZenEpilogueCard" && (
                    <Epilogue
                        step={activeStep}
                        pending={pending}
                        onFinish={() => submitStep("finish")}
                        onRestart={restartZen}
                    />
                )}
            </div>
        </div>
    );
}

export const [ZenDialogProvider, showZenDialog] = createConfirmProvider(
    ZenDialogForm,
    {
        dialogTitle: "Zen Mode",
        dialogModalClose: false,
        swipe: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none overflow-hidden",
    },
);
