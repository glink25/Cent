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
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { createFallbackZenStep } from "./fallback";
import { getPersonalZenPosts } from "./posts";
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

const MAX_STEPS = 10;

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
    return prompt.default.replace("${MAX_STEPS}", MAX_STEPS.toString());
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
            maxSteps: MAX_STEPS,
            currentStep: Math.max(1, session.steps.length + 1),
            mustEndIfCurrentStepGte: MAX_STEPS,
            avoidComponentTypes: previousComponentType
                ? [previousComponentType]
                : [],
            recentUsedCardTags: session.selectedTheme?.tags ?? [],
        },
    };

    const systemPrompt = await zenSystemPromptLoaded;
    try {
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
            message: JSON.stringify(payload),
            assets: [],
        });

        let latestHistory: History = session.history ?? [];
        for await (const chunk of stream) {
            latestHistory = chunk.history;
        }

        const step = getLatestZenStep(latestHistory);
        if (!step) {
            throw new Error("AI did not submit a Zen UI step.");
        }
        return {
            step,
            history: stripSystemMessages(latestHistory),
            usedFallback: false,
            focusDecision: latestFocusDecision,
        };
    } catch (error) {
        console.warn("[zen] fallback step used", error);
        const fallback = await getFallbackStep(session, context);
        return {
            step: fallback,
            history: stripSystemMessages(session.history ?? []),
            usedFallback: true,
            focusDecision: undefined,
        };
    }
}
