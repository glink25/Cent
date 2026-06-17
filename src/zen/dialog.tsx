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
import { getZenDayId, getZenSessionKey } from "./date";
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
    return {
        id: session.id,
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
                "zen-card-enter relative flex min-h-0 flex-1 overflow-hidden rounded-[2rem] bg-white/58 text-stone-900 shadow-[0_28px_90px_rgba(117,86,51,0.18)] ring-1 ring-white/45 backdrop-blur-3xl dark:bg-stone-950/46 dark:text-stone-50 dark:shadow-[0_28px_90px_rgba(0,0,0,0.34)] dark:ring-white/10",
                "before:pointer-events-none before:absolute before:inset-x-8 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-white/80 before:to-transparent dark:before:via-white/20",
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
                <div className="shrink-0 bg-white/10 px-5 pb-5 pt-3 shadow-[0_-18px_36px_rgba(255,255,255,0.12)] backdrop-blur-xl sm:px-7 sm:pb-7 dark:bg-black/5 dark:shadow-[0_-18px_36px_rgba(0,0,0,0.12)]">
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
        <div
            className={cn(
                "rounded-[1.35rem] bg-white/38 p-4 text-stone-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] ring-1 ring-white/38 backdrop-blur-2xl dark:bg-white/8 dark:text-stone-100 dark:ring-white/10",
                className,
            )}
        >
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
                "inline-flex min-h-12 items-center justify-center rounded-full px-6 text-sm font-medium transition duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:pointer-events-none disabled:opacity-45",
                variant === "primary" &&
                    "bg-stone-900/88 text-white shadow-[0_14px_34px_rgba(74,54,33,0.24)] hover:bg-stone-800 hover:shadow-[0_18px_42px_rgba(74,54,33,0.3)] dark:bg-amber-100/90 dark:text-stone-950 dark:hover:bg-amber-50",
                variant === "ghost" &&
                    "bg-white/24 text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/30 backdrop-blur-xl hover:bg-white/42 dark:bg-white/8 dark:text-stone-200 dark:ring-white/10 dark:hover:bg-white/14",
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
                "group relative min-h-16 overflow-hidden rounded-[1.35rem] bg-white/28 p-4 text-left text-stone-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-white/35 backdrop-blur-2xl transition duration-300 hover:-translate-y-0.5 hover:bg-white/44 disabled:pointer-events-none disabled:opacity-55 dark:bg-white/7 dark:text-stone-100 dark:ring-white/10 dark:hover:bg-white/12",
                active &&
                    "bg-amber-100/48 text-stone-950 shadow-[0_18px_45px_rgba(180,128,67,0.18),inset_0_1px_0_rgba(255,255,255,0.55)] ring-amber-200/70 dark:bg-amber-200/16 dark:text-amber-50 dark:ring-amber-100/24",
                className,
            )}
            {...props}
        >
            <span
                className={cn(
                    "pointer-events-none absolute inset-y-3 left-0 w-1 rounded-full bg-transparent transition",
                    active && "bg-amber-300/80 dark:bg-amber-200/60",
                )}
            />
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
                        {card.title}
                    </h2>
                }
            >
                <div className="space-y-6">
                    {card.subtitle && (
                        <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
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
                                        <span className="shrink-0 rounded-full bg-amber-200/55 px-2.5 py-1 text-[11px] text-amber-950 shadow-sm dark:bg-amber-100/18 dark:text-amber-100">
                                            Zen
                                        </span>
                                    )}
                                </div>
                                {option.subtitle && (
                                    <div className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
                                        {option.subtitle}
                                    </div>
                                )}
                            </ZenOptionButton>
                        ))}
                    </div>
                    {card.reason && (
                        <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                        <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
                            {card.description}
                        </p>
                    )}
                    <div className="grid gap-3">
                        {bills.length > 0 ? (
                            bills.map((bill) => (
                                <ZenSurface key={bill.id}>
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="min-w-0">
                                            <div className="truncate text-sm font-medium text-stone-900 dark:text-stone-50">
                                                {bill.categoryName}
                                            </div>
                                            <div className="mt-1 text-xs text-stone-500 dark:text-stone-400">
                                                {dayjs(bill.time).format(
                                                    "YYYY-MM-DD",
                                                )}
                                            </div>
                                        </div>
                                        <div className="shrink-0 rounded-full bg-white/36 px-3 py-1 text-sm font-semibold text-stone-800 dark:bg-white/8 dark:text-stone-100">
                                            {formatZenAmount(
                                                bill.amount,
                                                context.summary.currency,
                                            )}
                                        </div>
                                    </div>
                                    {bill.comment && (
                                        <div className="mt-3 text-xs leading-5 text-stone-500 dark:text-stone-400">
                                            {bill.comment}
                                        </div>
                                    )}
                                </ZenSurface>
                            ))
                        ) : (
                            <ZenSurface className="text-sm leading-6 text-stone-600 dark:text-stone-300">
                                {t("zen-bill-focus-empty")}
                            </ZenSurface>
                        )}
                    </div>
                    {card.question && (
                        <p className="rounded-[1.25rem] bg-amber-50/42 p-4 text-sm leading-7 text-stone-700 dark:bg-amber-100/8 dark:text-stone-200">
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                        <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
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
                                        <div className="mt-2 text-sm leading-6 text-stone-600 dark:text-stone-300">
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                    <p className="mt-4 rounded-[1.5rem] bg-white/28 p-5 text-sm leading-8 text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/28 backdrop-blur-xl dark:bg-white/7 dark:text-stone-300 dark:ring-white/10">
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                    <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
                        {t("zen-shredder-helper")}
                    </p>
                </div>
                <div className="grid gap-3">
                    {card.items.map((item) => (
                        <ZenSurface key={item.id} className="p-4">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="truncate text-sm font-medium text-stone-900 dark:text-stone-50">
                                        {item.label}
                                    </div>
                                    {(item.description ||
                                        item.categoryName) && (
                                        <div className="mt-2 text-xs leading-5 text-stone-500 dark:text-stone-400">
                                            {item.description ??
                                                item.categoryName}
                                        </div>
                                    )}
                                </div>
                                {typeof item.amount === "number" && (
                                    <div className="shrink-0 rounded-full bg-white/36 px-3 py-1 text-sm font-semibold text-stone-800 dark:bg-white/8 dark:text-stone-100">
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                        <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
                            {card.description}
                        </p>
                    )}
                </div>
                <div className="space-y-4">
                    <div className="rounded-[1.5rem] bg-white/24 px-4 py-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-1 ring-white/30 backdrop-blur-xl dark:bg-white/7 dark:ring-white/10">
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
                    <div className="flex justify-between gap-4 text-xs leading-5 text-stone-500 dark:text-stone-400">
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                    <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
                        {card.reason}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-3">
                        <ZenSurface>
                            <div className="text-xs text-stone-500 dark:text-stone-400">
                                {t("zen-budget-current")}
                            </div>
                            <div className="mt-2 text-lg font-semibold text-stone-950 dark:text-stone-50">
                                {formatZenAmount(
                                    card.currentBudget,
                                    context.summary.currency,
                                )}
                            </div>
                        </ZenSurface>
                        <ZenSurface>
                            <div className="text-xs text-stone-500 dark:text-stone-400">
                                {t("zen-budget-used")}
                            </div>
                            <div className="mt-2 text-lg font-semibold text-stone-950 dark:text-stone-50">
                                {formatZenAmount(
                                    card.currentUsed ?? 0,
                                    context.summary.currency,
                                )}
                            </div>
                        </ZenSurface>
                        <ZenSurface className="bg-amber-100/42 dark:bg-amber-100/10">
                            <div className="text-xs text-stone-500 dark:text-stone-400">
                                {t("zen-budget-suggested")}
                            </div>
                            <div className="mt-2 text-lg font-semibold text-stone-950 dark:text-stone-50">
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
                    <p className="text-xs leading-5 text-stone-500 dark:text-stone-400">
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
                        {card.title}
                    </h2>
                }
                footer={
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <span className="text-xs text-stone-500 dark:text-stone-400">
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
                        <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
                            {card.helperText}
                        </p>
                    )}
                    <textarea
                        value={value}
                        disabled={pending}
                        maxLength={card.maxLength}
                        placeholder={card.placeholder}
                        onChange={(event) => setValue(event.target.value)}
                        className="min-h-36 w-full resize-none rounded-[1.5rem] bg-white/34 p-5 text-sm leading-7 text-stone-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-white/35 backdrop-blur-2xl outline-none placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:opacity-60 dark:bg-white/8 dark:text-stone-100 dark:ring-white/10 dark:placeholder:text-stone-500"
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
                    <h2 className="text-2xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                    <p className="mt-3 text-sm leading-7 text-stone-600 dark:text-stone-300">
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
                            className="min-h-28 w-full resize-none rounded-[1.5rem] bg-white/34 p-5 text-sm leading-7 text-stone-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-white/35 backdrop-blur-2xl outline-none placeholder:text-stone-400 focus-visible:ring-2 focus-visible:ring-amber-200/80 disabled:opacity-60 dark:bg-white/8 dark:text-stone-100 dark:ring-white/10 dark:placeholder:text-stone-500"
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
        <CardShell className="bg-white/62 dark:bg-stone-950/52">
            <ZenCardLayout
                header={
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
                            {t("zen-completed-label")}
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                    <blockquote className="rounded-[1.6rem] bg-amber-50/55 p-5 text-base leading-8 text-stone-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-white/35 dark:bg-amber-100/10 dark:text-amber-50 dark:ring-amber-100/10">
                        {card.quote}
                    </blockquote>
                    <p className="text-sm leading-8 text-stone-600 dark:text-stone-300">
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
        <CardShell className="bg-white/62 dark:bg-stone-950/52">
            <ZenCardLayout
                header={
                    <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-stone-500 dark:text-stone-400">
                            {post.id}
                        </p>
                        <h2 className="mt-3 text-3xl font-semibold tracking-normal text-stone-950 dark:text-stone-50">
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
                    <p className="text-sm leading-7 text-stone-600 dark:text-stone-300">
                        {t("zen-today-completed-hint")}
                    </p>
                    {post.theme && (
                        <ZenSurface className="text-sm leading-6">
                            {post.theme.title}
                        </ZenSurface>
                    )}
                    <blockquote className="rounded-[1.6rem] bg-amber-50/55 p-5 text-base leading-8 text-stone-800 shadow-[inset_0_1px_0_rgba(255,255,255,0.45)] ring-1 ring-white/35 dark:bg-amber-100/10 dark:text-amber-50 dark:ring-amber-100/10">
                        {post.quote}
                    </blockquote>
                    <p className="text-sm leading-8 text-stone-600 dark:text-stone-300">
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
            className={cn(
                "zen-gradient-drift relative min-h-full overflow-hidden text-stone-900 dark:text-stone-50",
                isBackgroundFocused && "zen-gradient-focus",
            )}
        >
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_12%,rgba(255,255,255,0.58),transparent_34%),linear-gradient(180deg,rgba(255,255,255,0.28),rgba(255,255,255,0.02))] dark:bg-[radial-gradient(circle_at_50%_8%,rgba(255,244,214,0.12),transparent_35%),linear-gradient(180deg,rgba(0,0,0,0.08),rgba(0,0,0,0.3))]" />
            <div className="relative mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-5 px-4 py-5 sm:px-6 sm:py-7">
                <div className="flex shrink-0 items-center justify-between gap-3 rounded-full bg-white/22 px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.38)] ring-1 ring-white/26 backdrop-blur-2xl dark:bg-white/7 dark:ring-white/10">
                    <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-stone-600 dark:text-stone-300">
                            {t("zen-header-label")}
                        </div>
                        <div className="text-sm text-stone-500 dark:text-stone-400">
                            {todayLabel}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="grid size-11 place-items-center rounded-full bg-white/28 text-stone-600 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-white/30 backdrop-blur-xl transition hover:bg-white/46 hover:text-stone-900 dark:bg-white/8 dark:text-stone-300 dark:ring-white/10 dark:hover:bg-white/14"
                        onClick={onCancel}
                    >
                        <i className="icon-[mdi--close] size-5"></i>
                    </button>
                </div>

                {state.type === "loading" && (
                    <CardShell className="min-h-72">
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-sm text-stone-600 dark:text-stone-300">
                            <div className="rounded-full bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-white/30 backdrop-blur-xl dark:bg-white/8 dark:ring-white/10">
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
                                <h2 className="text-2xl font-semibold text-stone-950 dark:text-stone-50">
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
                            <p className="text-sm leading-7 text-stone-600 dark:text-stone-300">
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
                        <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center text-sm text-stone-600 dark:text-stone-300">
                            <div className="rounded-full bg-white/28 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.4)] ring-1 ring-white/30 backdrop-blur-xl dark:bg-white/8 dark:ring-white/10">
                                <Loading className="[&_i]:size-6" />
                            </div>
                            <div>{t("zen-loading-period")}</div>
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
