import {
    createSession,
    createTool,
    type History,
    type Provider,
    type Tool,
    type ToolMessage,
} from "@glink25/chaty";
import { isZenFallbackDevMode } from "./dev";
import {
    createFallbackEpilogueStep,
    createFallbackReflectionStep,
    createFallbackZenStep,
} from "./fallback";
import { canShowEpilogue, canShowIntention } from "./journey";
import { ZenFocusDecisionSchema, ZenUIStepSchema } from "./schema";
import type {
    ZenContext,
    ZenFocusDecision,
    ZenSessionState,
    ZenUIStep,
} from "./types";

const ShowZenStepTool = createTool({
    name: "showZenStep",
    describe:
        "Render exactly one Zen Mode UI step. You must call this tool once and only once for each Zen turn.",
    argSchema: ZenUIStepSchema,
    returnSchema: ZenUIStepSchema,
    handler: (step) => step,
});

function createDecideZenFocusTool(
    onDecision: (decision: ZenFocusDecision) => void,
) {
    return createTool({
        name: "decideZenFocus",
        describe:
            "Choose the bill review period for this Zen session. Use this when you decide the session should focus on a non-default time range, or when you want to state the period explicitly before rendering UI.",
        argSchema: ZenFocusDecisionSchema,
        returnSchema: ZenFocusDecisionSchema,
        handler: (decision) => {
            onDecision(decision);
            return decision;
        },
    });
}

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
    const latest = toolMessages.at(-1);
    const parsed = ZenUIStepSchema.safeParse(latest?.formatted.returns);
    return parsed.success ? parsed.data : undefined;
}

function getFallbackStep(session: ZenSessionState, context: ZenContext) {
    return createFallbackZenStep({ session, context });
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
        journeyPlan: session.journeyPlan,
        exploration: session.exploration,
        extractedInsights: session.extractedInsights,
        currentStepId: session.currentStep?.stepId,
    };
}

function contextSignature(context: ZenContext) {
    return `${context.zenDayId}:${context.period.start}-${context.period.end}`;
}

/** period 无关、一个 session 内不变的背景信息，只在首轮下发一次。 */
function backgroundContext(context: ZenContext) {
    return {
        zenDayId: context.zenDayId,
        now: context.now,
        calendarPosition: context.calendarPosition,
        recentZenPosts: context.recentZenPosts,
        lastZenPost: context.lastZenPost,
        suggestedPeriods: context.suggestedPeriods,
    };
}

/** 与 period 绑定、period 变化即重算的分析结果，首轮 + period 变化时下发。 */
function periodContext(context: ZenContext) {
    return {
        period: context.period,
        focusDecision: context.focusDecision,
        summary: context.summary,
        topCategories: context.topCategories,
        budgets: context.budgets,
        signals: context.signals,
        candidateGroups: context.candidateGroups,
        candidateBills: context.candidateBills,
        habitPatterns: context.habitPatterns,
    };
}

function normalizeStepProgress(
    step: ZenUIStep,
    session: ZenSessionState,
): ZenUIStep {
    const current = Math.max(1, session.steps.length + 1);
    return {
        ...step,
        sessionId: session.id,
        progress: {
            current,
            max: session.journeyPlan.hardMaxSteps,
            shouldEndSoon:
                current >= session.journeyPlan.earliestEpilogueStep - 1,
        },
    };
}

async function createFallbackResult(
    session: ZenSessionState,
    context: ZenContext,
) {
    const current = session.steps.length + 1;
    const fallback =
        current >= session.journeyPlan.hardMaxSteps
            ? createFallbackEpilogueStep(session)
            : await getFallbackStep(session, context);
    const guardedFallback = invalidStepReason(fallback, session, context)
        ? createFallbackReflectionStep({ session, context })
        : fallback;
    return {
        step: normalizeStepProgress(guardedFallback, session),
        history: stripSystemMessages(session.history ?? []),
        usedFallback: true,
        focusDecision: undefined,
    };
}

function invalidStepReason(
    step: ZenUIStep,
    session: ZenSessionState,
    context: ZenContext,
) {
    const current = session.steps.length + 1;
    if (
        step.component.type === "ZenEpilogueCard" &&
        !canShowEpilogue(session, context, current)
    ) {
        return "结语出现得太早：继续承接用户回答，并探索尚未覆盖的维度。";
    }
    if (
        step.component.type === "IntentionCard" &&
        !canShowIntention(session, context)
    ) {
        return "意图卡出现得太早：先探索至少两个维度，并获得至少两次有效回应。";
    }
    if (
        current >= session.journeyPlan.hardMaxSteps &&
        step.component.type !== "ZenEpilogueCard"
    ) {
        return "已经到达硬上限，本轮必须生成 ZenEpilogueCard。";
    }
    return undefined;
}

export async function requestNextZenStep({
    session,
    context,
    provider,
    hostTools,
    configId,
    lastUserInput,
}: {
    session: ZenSessionState;
    context: ZenContext;
    provider: Provider;
    hostTools: Tool[];
    configId?: string;
    lastUserInput?: unknown;
}): Promise<{
    step: ZenUIStep;
    history: History;
    usedFallback: boolean;
    focusDecision?: ZenFocusDecision;
    sentContextSignature?: string;
}> {
    if (isZenFallbackDevMode()) {
        return createFallbackResult(session, context);
    }
    const previousComponentType = session.currentStep?.component.type;
    let latestFocusDecision: ZenFocusDecision | undefined;
    const DecideZenFocusTool = createDecideZenFocusTool((decision) => {
        latestFocusDecision = decision;
    });
    const firstTurn = !session.history?.length;
    const periodSig = contextSignature(context);
    const includePeriodBlock =
        firstTurn || session.sentContextSignature !== periodSig;
    const zenContext = {
        ...(firstTurn ? backgroundContext(context) : {}),
        ...(includePeriodBlock ? periodContext(context) : {}),
    };
    const payload = {
        ...(firstTurn || includePeriodBlock ? { zenContext } : {}),
        sessionState: compactSessionState(session),
        lastUserInput,
        constraints: {
            targetSteps: session.journeyPlan.targetSteps,
            earliestEpilogueStep: session.journeyPlan.earliestEpilogueStep,
            hardMaxSteps: session.journeyPlan.hardMaxSteps,
            currentStep: Math.max(1, session.steps.length + 1),
            minimumExploration: {
                requiredCoveredDimensions: 2,
                requiredMeaningfulResponses: 2,
            },
            extensionUsed: session.journeyPlan.extensionUsed,
            avoidComponentTypes: previousComponentType
                ? [previousComponentType]
                : [],
            recentUsedCardTags: session.selectedTheme?.tags ?? [],
        },
    };

    const systemPrompt = await zenSystemPromptLoaded;
    const runDirector = async (correction?: string) => {
        const next = createSession({
            history: stripSystemMessages(session.history ?? []),
            provider,
            tools: [
                DecideZenFocusTool,
                ShowZenStepTool,
                ...hostTools,
            ] as Tool[],
            skills: [],
            systemPrompt,
            configId,
            maxToolRounds: 6,
        });
        const stream = await next({
            message: JSON.stringify({ ...payload, correction }),
            assets: [],
        });
        let history: History = session.history ?? [];
        for await (const chunk of stream) history = chunk.history;
        const step = getLatestZenStep(history);
        if (!step) throw new Error("AI did not submit a Zen UI step.");
        return { step, history };
    };

    let result = await runDirector();
    const firstInvalidReason = invalidStepReason(result.step, session, context);
    if (firstInvalidReason) {
        result = await runDirector(firstInvalidReason);
    }
    const finalInvalidReason = invalidStepReason(result.step, session, context);
    if (finalInvalidReason) throw new Error(finalInvalidReason);
    return {
        step: normalizeStepProgress(result.step, session),
        history: stripSystemMessages(result.history),
        usedFallback: false,
        focusDecision: latestFocusDecision,
        sentContextSignature: periodSig,
    };
}
