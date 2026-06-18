import { z } from "zod";
import {
    createSession,
    createTool,
    type History,
    type Tool,
    type ToolMessage,
} from "@/assistant";
import {
    AnalyzeBillsTool,
    GetAccountMetaTool,
    QueryBillsTool,
} from "@/components/assistant/tools/ledger-tools";
import { createCentAIProvider } from "@/components/assistant/tools/provider";
import { getPersonalZenPosts } from "@/hooks/use-zen";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { isZenFallbackDevMode } from "./dev";
import {
    createFallbackEpilogueStep,
    createFallbackReflectionStep,
    createFallbackZenStep,
} from "./fallback";
import { canShowEpilogue, canShowIntention } from "./journey";
import {
    ZenFocusDecisionSchema,
    ZenPostSchema,
    ZenUIStepSchema,
} from "./schema";
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

const GetRecentZenPostsTool = createTool({
    name: "getRecentZenPosts",
    describe:
        "Read recent compact Zen Post summaries for this user. Use this only to avoid repeating recent tone or theme.",
    argSchema: z.object({
        limit: z.number().int().min(1).max(10).default(5),
    }),
    returnSchema: z.array(ZenPostSchema),
    handler: ({ limit }) => getPersonalZenPosts().slice(0, limit),
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

const ZenAIProvider = createCentAIProvider(() => {
    const userId = useUserStore.getState().id;
    return useLedgerStore.getState().infos?.meta.personal?.[userId]?.zen
        ?.aiConfigId;
});

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
    lastUserInput,
}: {
    session: ZenSessionState;
    context: ZenContext;
    lastUserInput?: unknown;
}): Promise<{
    step: ZenUIStep;
    history: History;
    usedFallback: boolean;
    focusDecision?: ZenFocusDecision;
}> {
    if (isZenFallbackDevMode()) {
        return createFallbackResult(session, context);
    }
    const previousComponentType = session.currentStep?.component.type;
    let latestFocusDecision: ZenFocusDecision | undefined;
    const DecideZenFocusTool = createDecideZenFocusTool((decision) => {
        latestFocusDecision = decision;
    });
    const payload = {
        zenContext: context,
        sessionState: {
            ...session,
            history: undefined,
        },
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
    try {
        const runDirector = async (correction?: string) => {
            const next = createSession({
                history: stripSystemMessages(session.history ?? []),
                provider: ZenAIProvider,
                tools: [
                    DecideZenFocusTool,
                    ShowZenStepTool,
                    GetRecentZenPostsTool,
                    AnalyzeBillsTool,
                    QueryBillsTool,
                    GetAccountMetaTool,
                ] as Tool[],
                skills: [],
                systemPrompt,
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
        const firstInvalidReason = invalidStepReason(
            result.step,
            session,
            context,
        );
        if (firstInvalidReason) {
            result = await runDirector(firstInvalidReason);
        }
        const finalInvalidReason = invalidStepReason(
            result.step,
            session,
            context,
        );
        if (finalInvalidReason) throw new Error(finalInvalidReason);
        return {
            step: normalizeStepProgress(result.step, session),
            history: stripSystemMessages(result.history),
            usedFallback: false,
            focusDecision: latestFocusDecision,
        };
    } catch (error) {
        console.warn("[zen] fallback step used", error);
        return createFallbackResult(session, context);
    }
}
