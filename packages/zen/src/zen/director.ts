import {
    type ContextState,
    createSession,
    createTool,
    type History,
    type Provider,
    type SkillInput,
    type Tool,
    type ToolMessage,
} from "@glink25/agent-core";
import dayjs from "dayjs";
import { z } from "zod";
import type {
    ZenDirectorMode,
    ZenLocale,
    ZenRuntimeHost,
} from "../runtime/types";
import {
    getCalendarPosition,
    getDefaultZenPeriod,
    getSuggestedZenPeriods,
} from "./date";
import {
    createFallbackEpilogueStep,
    createFallbackReflectionStep,
    createFallbackZenStep,
} from "./fallback";
import { canShowEpilogue, mergeDirectorState } from "./journey";
import {
    ZenFocusDecisionSchema,
    ZenUIStepSchema,
    ZenUIStepToolSchema,
} from "./schema";
import type {
    ZenContext,
    ZenFocusDecision,
    ZenPost,
    ZenSessionState,
    ZenUIStep,
} from "./types";
import zenPersonality from "./zen-personality.txt?raw";

const ShowZenStepTool = createTool({
    name: "showZenStep",
    exposure: { native: true, code: false },
    effect: "ui",
    endsTurn: true,
    describe:
        "Render exactly one Zen step. interaction requires fields (at least one), submitLabel and allowSkip; completion requires intent=ending and completion. Always include content, using [] when empty.",
    argSchema: ZenUIStepToolSchema,
    returnSchema: ZenUIStepSchema,
    handler: (step) => ZenUIStepSchema.parse(step),
});

function createDecideZenFocusTool(
    onDecision: (decision: ZenFocusDecision) => void,
) {
    return createTool({
        name: "decideZenFocus",
        exposure: { native: true, code: false },
        effect: "ui",
        describe:
            "Choose the bill review period for this Zen session. Use this when you decide the session should focus on a non-default time range, or when you want to state the period explicitly before rendering UI.",
        argSchema: ZenFocusDecisionSchema,
        returnSchema: ZenFocusDecisionSchema,
        handler: (decision) => {
            const { start, end } = decision.period;
            if (
                !Number.isSafeInteger(start) ||
                !Number.isSafeInteger(end) ||
                start > end
            )
                throw new Error(
                    "Choose a valid review period in epoch milliseconds",
                );
            onDecision(decision);
            return decision;
        },
    });
}

export const defaultZenPersonality = zenPersonality.trim();

// ./zen-director.md closure
const zenSystemPromptLoaded = (async () => {
    const prompt = await import("./zen-director.md?raw");
    return prompt.default;
})();

function stripSystemMessages(history: History): History {
    return history.filter((message) => message.role !== "system");
}

function getLatestZenStep(history: History): ZenUIStep | undefined {
    const toolMessages = history.filter(
        (message) =>
            message.role === "tool" &&
            message.formatted.name === ShowZenStepTool.name,
    ) as ToolMessage[];
    for (const message of [...toolMessages].reverse()) {
        const parsed = ZenUIStepSchema.safeParse(message.formatted.returns);
        if (parsed.success) return parsed.data;
    }
    return undefined;
}

function getLatestZenStepError(history: History) {
    const latest = [...history]
        .reverse()
        .find(
            (message) =>
                message.role === "tool" &&
                message.formatted.name === ShowZenStepTool.name,
        ) as ToolMessage | undefined;
    if (!latest?.formatted.errors) return undefined;
    return latest.formatted.errors instanceof Error
        ? latest.formatted.errors.message
        : JSON.stringify(latest.formatted.errors);
}

function getFallbackStep(
    session: ZenSessionState,
    context: ZenContext,
    locale: ZenLocale,
) {
    return createFallbackZenStep({ session, context, locale });
}

/**
 * 只发给模型「权威且体量小」的 session 状态。
 * 刻意去掉 `steps[]`、`currentStep`、`history`：每个 step 的 component / billSnapshots /
 * userInput 都已存在于保留的 history 中（showZenStep 返回 + 历次 lastUserInput），重发即重复。
 */
function compactSessionState(session: ZenSessionState) {
    return {
        id: session.id,
        period: session.period,
        mood: session.mood,
        selectedTheme: session.selectedTheme,
        focusDecision: session.focusDecision,
        status: session.status,
        exploration: session.exploration,
        extractedInsights: session.extractedInsights,
        currentStepId: session.currentStep?.stepId,
    };
}

export function createZenOpeningContext(
    zenDayId: string,
    latest?: Pick<ZenPost, "completedAt">,
    now = dayjs(),
): ZenContext {
    return {
        zenDayId,
        now: now.toISOString(),
        calendarPosition: getCalendarPosition(now),
        period: getDefaultZenPeriod({ now }),
        suggestedPeriods: getSuggestedZenPeriods({ now, lastZenPost: latest }),
        lastZenPost: latest,
        recentZenPosts: [],
        dataStatus: "unread",
        summary: {
            billCount: 0,
            incomeTotal: 0,
            expenseTotal: 0,
            netAmount: 0,
            currency: "",
        },
        topCategories: [],
        budgets: [],
        candidateBills: [],
        candidateGroups: [],
        signals: [],
        habitPatterns: [],
    };
}

function createReadZenHistoryTool(listPosts: ZenRuntimeHost["listZenPosts"]) {
    return createTool({
        name: "readZenHistory",
        exposure: { native: true, code: true },
        effect: "read",
        describe:
            "Read up to five short summaries of recent saved Zen reflections for the current user and ledger. Use only when the user's chosen topic benefits from continuity.",
        argSchema: z.object({
            limit: z.number().int().min(1).max(5).default(2),
        }),
        returnSchema: z.unknown(),
        async handler({ limit }, { signal }) {
            signal?.throwIfAborted();
            const posts = await listPosts({ limit: limit + 1 });
            signal?.throwIfAborted();
            return {
                items: posts.slice(0, limit).map((post) => ({
                    completedAt: post.completedAt,
                    period: post.period,
                    title: post.title?.slice(0, 120),
                    summary: post.summary?.slice(0, 300),
                })),
                hasMore: posts.length > limit,
            };
        },
    });
}

function normalizeStepProgress(
    step: ZenUIStep,
    session: ZenSessionState,
    directorMode: ZenDirectorMode,
): ZenUIStep {
    const current = Math.max(1, session.steps.length + 1);
    return {
        ...step,
        sessionId: session.id,
        progress: {
            current,
            max: session.journeyPlan.hardMaxSteps,
            shouldEndSoon:
                current >=
                (directorMode === "local"
                    ? session.journeyPlan.earliestEpilogueStep
                    : session.journeyPlan.hardMaxSteps) -
                    1,
        },
    };
}

async function createFallbackResult(
    session: ZenSessionState,
    context: ZenContext,
    locale: ZenLocale,
) {
    const current = session.steps.length + 1;
    const fallback =
        current >= session.journeyPlan.hardMaxSteps
            ? createFallbackEpilogueStep(session, context, locale)
            : await getFallbackStep(session, context, locale);
    const guardedFallback =
        fallback.mode === "completion" &&
        !canShowEpilogue(
            {
                ...session,
                exploration: mergeDirectorState(session.exploration, fallback),
            },
            context,
            current,
        )
            ? createFallbackReflectionStep({ session, context, locale })
            : fallback;
    return {
        step: normalizeStepProgress(guardedFallback, session, "local"),
        history: stripSystemMessages(session.history ?? []),
        usedFallback: true,
        focusDecision: undefined,
    };
}

function invalidStepReason(step: ZenUIStep, session: ZenSessionState) {
    const current = session.steps.length + 1;
    if (
        current >= session.journeyPlan.hardMaxSteps &&
        step.mode !== "completion"
    ) {
        return "已经到达硬上限，本轮必须生成 completion step。";
    }
    return undefined;
}

export async function requestNextZenStep({
    session,
    context,
    provider,
    hostTools = [],
    skills = [],
    listPosts,
    resources = new Map<string, unknown>(),
    configId,
    directorMode,
    personalityPrompt,
    locale = "zh",
    lastUserInput,
    signal,
}: {
    session: ZenSessionState;
    context: ZenContext;
    provider?: Provider;
    hostTools?: Tool[];
    skills?: SkillInput[];
    listPosts?: ZenRuntimeHost["listZenPosts"];
    resources?: Map<string, unknown>;
    configId?: string;
    directorMode: ZenDirectorMode;
    personalityPrompt?: string;
    locale?: ZenLocale;
    lastUserInput?: unknown;
    signal?: AbortSignal;
}): Promise<{
    step: ZenUIStep;
    history: History;
    contextState?: ContextState;
    usedFallback: boolean;
    focusDecision?: ZenFocusDecision;
}> {
    if (directorMode === "local") {
        return createFallbackResult(session, context, locale);
    }
    if (!provider) throw new Error("Zen AI runtime is unavailable");
    const previousFieldTypes =
        session.currentStep?.mode === "interaction"
            ? session.currentStep.fields.map((field) => field.type)
            : [];
    let latestFocusDecision: ZenFocusDecision | undefined;
    const DecideZenFocusTool = createDecideZenFocusTool((decision) => {
        latestFocusDecision = decision;
    });
    const firstTurn = !session.history?.length;
    const personality = personalityPrompt?.trim() || defaultZenPersonality;
    const payload = {
        personalityPrompt: personality,
        ...(firstTurn
            ? {
                  zenContext: {
                      zenDayId: context.zenDayId,
                      now: context.now,
                      timeZone:
                          Intl.DateTimeFormat().resolvedOptions().timeZone,
                      calendarPosition: context.calendarPosition,
                      suggestedPeriods: context.suggestedPeriods,
                      lastZenCompletedAt: context.lastZenPost?.completedAt,
                  },
              }
            : {}),
        sessionState: compactSessionState(session),
        lastUserInput,
        constraints: {
            hardMaxSteps: session.journeyPlan.hardMaxSteps,
            currentStep: Math.max(1, session.steps.length + 1),
            extensionUsed: session.journeyPlan.extensionUsed,
            avoidFieldTypes: previousFieldTypes,
        },
    };

    const systemPrompt = await zenSystemPromptLoaded;
    const tools = [
        DecideZenFocusTool,
        ShowZenStepTool,
        ...hostTools,
        ...(listPosts ? [createReadZenHistoryTool(listPosts)] : []),
    ] as Tool[];
    const runDirector = async (
        baseHistory = stripSystemMessages(session.history ?? []),
        contextCheckpoint = session.contextState,
        correction?: string,
    ) => {
        const next = createSession({
            history: baseHistory,
            contextState: contextCheckpoint,
            provider,
            tools,
            skills,
            systemPrompt,
            configId,
        });
        signal?.throwIfAborted();
        const pending = next({
            message: JSON.stringify(
                correction ? { ...payload, correction } : payload,
            ),
            resources,
        });
        const cancel = () => pending.abort();
        signal?.addEventListener("abort", cancel, { once: true });
        let history = baseHistory;
        let contextState = contextCheckpoint;
        try {
            for await (const chunk of await pending) {
                history = chunk.history;
                contextState = chunk.contextState;
            }
        } finally {
            signal?.removeEventListener("abort", cancel);
        }
        signal?.throwIfAborted();
        const currentHistory = history.slice(baseHistory.length + 2);
        const step = getLatestZenStep(currentHistory);
        if (!step) {
            const toolError = getLatestZenStepError(currentHistory);
            throw new Error(
                toolError
                    ? `showZenStep validation failed: ${toolError}`
                    : "AI did not call showZenStep before ending the turn.",
            );
        }
        return { step, history, contextState };
    };

    let result = await runDirector();
    const firstInvalidReason = invalidStepReason(result.step, session);
    if (firstInvalidReason) {
        result = await runDirector(
            stripSystemMessages(result.history),
            result.contextState,
            firstInvalidReason,
        );
    }
    const finalInvalidReason = invalidStepReason(result.step, session);
    if (finalInvalidReason) throw new Error(finalInvalidReason);
    return {
        step: normalizeStepProgress(result.step, session, "ai"),
        history: stripSystemMessages(result.history),
        contextState: result.contextState,
        usedFallback: false,
        focusDecision: latestFocusDecision,
    };
}
