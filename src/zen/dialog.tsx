import dayjs from "dayjs";
import {
    type ReactNode,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { toast } from "sonner";
import createConfirmProvider from "@/components/confirm";
import Loading from "@/components/loading";
import { Button } from "@/components/ui/button";
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
    FreeInputCard,
    InsightTextCard,
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
    return component.title;
}

function createSessionStep(step: ZenUIStep, userInput: unknown) {
    return {
        stepId: step.stepId,
        componentType: step.component.type,
        aiPromptSummary: cardSummary(step.component, userInput),
        userInput,
        relatedBillIds: step.dataBindings?.billIds,
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
        intention: component.intention,
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
                "rounded-lg border border-white/10 bg-white/80 text-stone-900 shadow-sm dark:bg-stone-950/70 dark:text-stone-50 p-5",
                className,
            )}
        >
            {children}
        </div>
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
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">{card.title}</h2>
                    {card.subtitle && (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {card.subtitle}
                        </p>
                    )}
                </div>
                <div className="grid gap-2">
                    {card.options.map((option) => (
                        <button
                            key={option.id}
                            type="button"
                            disabled={pending}
                            className="rounded-md border bg-background/70 p-4 text-left transition hover:bg-accent disabled:opacity-60"
                            onClick={() => onSubmit(option.id)}
                        >
                            <div className="font-medium">{option.title}</div>
                            {option.subtitle && (
                                <div className="mt-1 text-sm text-muted-foreground">
                                    {option.subtitle}
                                </div>
                            )}
                        </button>
                    ))}
                </div>
            </div>
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
            <div className="space-y-5">
                <div>
                    <h2 className="text-xl font-semibold">{card.title}</h2>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">
                        {card.body}
                    </p>
                </div>
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => onSubmit("skip")}
                    >
                        {t("zen-skip")}
                    </Button>
                    <Button
                        type="button"
                        disabled={pending}
                        onClick={() => onSubmit("continue")}
                    >
                        {t("zen-continue")}
                    </Button>
                </div>
            </div>
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
    return (
        <CardShell>
            <div className="space-y-5">
                <div>
                    <h2 className="text-xl font-semibold">{card.title}</h2>
                    {card.description && (
                        <p className="mt-2 text-sm leading-6 text-muted-foreground">
                            {card.description}
                        </p>
                    )}
                </div>
                <input
                    type="range"
                    min={card.minValue}
                    max={card.maxValue}
                    value={value}
                    disabled={pending}
                    onChange={(event) => setValue(Number(event.target.value))}
                    className="w-full accent-primary"
                />
                <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{card.minLabel}</span>
                    <span>{card.maxLabel}</span>
                </div>
                <div className="flex justify-end">
                    <Button
                        type="button"
                        disabled={pending}
                        onClick={() => onSubmit(value)}
                    >
                        {t("zen-place-here")}
                    </Button>
                </div>
            </div>
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
            <div className="space-y-4">
                <div>
                    <h2 className="text-xl font-semibold">{card.title}</h2>
                    {card.helperText && (
                        <p className="mt-2 text-sm text-muted-foreground">
                            {card.helperText}
                        </p>
                    )}
                </div>
                <textarea
                    value={value}
                    disabled={pending}
                    maxLength={card.maxLength}
                    placeholder={card.placeholder}
                    onChange={(event) => setValue(event.target.value)}
                    className="min-h-28 w-full resize-none rounded-md border border-input bg-background/70 p-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
                <div className="flex items-center justify-between gap-3">
                    <span className="text-xs text-muted-foreground">
                        {value.length}/{card.maxLength}
                    </span>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            disabled={pending}
                            onClick={() => onSubmit("")}
                        >
                            {t("zen-skip")}
                        </Button>
                        <Button
                            type="button"
                            disabled={pending}
                            onClick={() => onSubmit(value)}
                        >
                            {t("zen-continue")}
                        </Button>
                    </div>
                </div>
            </div>
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
        <CardShell>
            <div className="space-y-5">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {t("zen-completed-label")}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                        {card.title}
                    </h2>
                </div>
                <blockquote className="rounded-md bg-muted/70 p-4 text-sm leading-7">
                    {card.quote}
                </blockquote>
                <p className="text-sm leading-7 text-muted-foreground">
                    {card.summary}
                </p>
                {card.intention && (
                    <div className="rounded-md border p-3 text-sm">
                        {card.intention}
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={onRestart}
                    >
                        {t("zen-regenerate")}
                    </Button>
                    <Button type="button" disabled={pending} onClick={onFinish}>
                        {t("zen-save-today-zen")}
                    </Button>
                </div>
            </div>
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
        <CardShell>
            <div className="space-y-5">
                <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                        {post.id}
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                        {t("zen-today-completed-title")}
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground">
                        {t("zen-today-completed-hint")}
                    </p>
                </div>
                {post.theme && (
                    <div className="rounded-md border p-3 text-sm">
                        {post.theme.title}
                    </div>
                )}
                <blockquote className="rounded-md bg-muted/70 p-4 text-sm leading-7">
                    {post.quote}
                </blockquote>
                <p className="text-sm leading-7 text-muted-foreground">
                    {post.summary}
                </p>
                {post.intention && (
                    <div className="rounded-md border p-3 text-sm">
                        {post.intention}
                    </div>
                )}
                <div className="flex justify-end gap-2">
                    <Button
                        type="button"
                        variant="outline"
                        disabled={pending}
                        onClick={onRestart}
                    >
                        {t("zen-regenerate")}
                    </Button>
                    <Button type="button" onClick={onClose}>
                        {t("zen-close")}
                    </Button>
                </div>
            </div>
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
            if (currentStep.component.type === "ThemeSelectorCard") {
                const card = currentStep.component;
                selectedTheme =
                    card.options.find((option) => option.id === userInput) ??
                    card.options.find(
                        (option) => option.id === card.recommendedOptionId,
                    ) ??
                    card.options[0];
            }
            const nextSession: ZenSessionState = {
                ...state.session,
                selectedTheme,
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

    return (
        <div className="min-h-full bg-stone-100 text-foreground dark:bg-stone-900">
            <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col gap-4 p-4 sm:p-6">
                <div className="flex items-center justify-between gap-3">
                    <div>
                        <div className="text-xs uppercase tracking-[0.2em] text-muted-foreground">
                            {t("zen-header-label")}
                        </div>
                        <div className="text-sm text-muted-foreground">
                            {todayLabel}
                        </div>
                    </div>
                    <button
                        type="button"
                        className="rounded-full p-2 text-muted-foreground hover:bg-background"
                        onClick={onCancel}
                    >
                        <i className="icon-[mdi--close] size-5"></i>
                    </button>
                </div>

                {state.type === "loading" && (
                    <CardShell className="min-h-72">
                        <div className="flex h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loading className="[&_i]:size-5" />
                            {t("zen-loading-open")}
                        </div>
                    </CardShell>
                )}

                {state.type === "error" && (
                    <CardShell>
                        <div className="space-y-4">
                            <h2 className="text-xl font-semibold">
                                {t("zen-error-title")}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                {state.message}
                            </p>
                            <div className="flex justify-end">
                                <Button type="button" onClick={onCancel}>
                                    {t("zen-close")}
                                </Button>
                            </div>
                        </div>
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
                        <div className="flex h-60 items-center justify-center gap-2 text-sm text-muted-foreground">
                            <Loading className="[&_i]:size-5" />
                            {t("zen-loading-period")}
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

                {activeStep?.component.type === "InsightTextCard" && (
                    <InsightCard
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

                {activeStep?.component.type === "FreeInputCard" && (
                    <FreeInputCardView
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
            "h-full w-full max-h-full max-w-full rounded-none overflow-hidden sm:rounded-lg sm:h-[min(760px,calc(100vh-32px))] sm:w-[min(720px,calc(100vw-32px))]",
    },
);
