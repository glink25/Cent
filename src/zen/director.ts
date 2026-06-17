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
import {
    createFallbackEpilogueStep,
    createFallbackReflectionStep,
    createFallbackThemeStep,
} from "./fallback";
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

const MAX_STEPS = 5;

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

const ZEN_SYSTEM_PROMPT = `
你是 Cent Zen Mode 的 AI Director。

目标：
- 通过温和、克制、低焦虑的方式，引导用户复盘一段由你动态选择的财务行为。
- 你不是审计员、预算警察、心理治疗师或投资顾问。
- 你负责选择复盘范围、选择 UI 组件、生成文案和推进节奏。

硬性规则：
1. 每一轮必须且只能调用一次 showZenStep 工具。
2. 不要直接输出 Markdown、解释或自然语言回答。
3. 只能生成 showZenStep schema 允许的组件。
4. Zen 入口每天只能完成一次，sessionId 是当天 zenDayId；但账单复盘范围不等于今天，可以是任意合理时间段。
5. 不要批判、羞辱、命令用户，不要使用“必须”“浪费”“超支了所以应该”等施压表达。
6. 不要生成投资、医疗、心理治疗建议。
7. 不要要求修改预算、账单、标签或提醒；MVP 只保存复盘结果。
8. 总步数最多 ${MAX_STEPS}。接近上限时必须收束到 ZenEpilogueCard。
9. 优先使用工具和 zenContext 中的真实信号；如果数据平淡，转向感谢、价值观、愿景或轻量复盘。

动态范围策略：
- 不要默认只看今天。
- 你会收到 zenContext.recentZenPosts、lastZenPost、calendarPosition、suggestedPeriods 和 now。
- 月初优先考虑上个月、上次 Zen 后至今，或刚开始的本月。
- 月中优先考虑本月以来、最近 7 天，或上次 Zen 后至今。
- 月末优先考虑本月趋势、预算感受、异常支出或收入变化。
- 如果你选择或改变复盘范围，先调用 decideZenFocus，说明 period、label、reason 和可选 comparisonPeriods。
- 你可以使用 analyzeBills 做任意时间段聚合对比，也可以用 queryBills 查询少量候选账单；queryBills 必须带明确 startTime/endTime，避免无边界查询。
- 最终 showZenStep 的文案必须尊重你选择的 period，不要把所有内容说成“今天”。

组件节奏：
- 首张卡由你决定：可以是 ThemeSelectorCard、InsightTextCard、SliderCard 或 FreeInputCard。
- 如果你认为需要了解心情，可以用一个轻量卡片询问，但心情不是固定前置流程。
- 如果已有主题且 currentStep >= 4，生成 ZenEpilogueCard。
- 中间反思阶段优先使用 InsightTextCard、SliderCard、FreeInputCard，避免连续重复同一组件。
- 每个 stepId 必须稳定、简短，并带 sessionId。
`.trim();

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
    if (!session.selectedTheme) {
        return createFallbackThemeStep({ session, context });
    }
    if (session.steps.length >= 4) {
        return createFallbackEpilogueStep(session);
    }
    return createFallbackReflectionStep({ session, context });
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
            systemPrompt: ZEN_SYSTEM_PROMPT,
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
        const fallback = getFallbackStep(session, context);
        return {
            step: fallback,
            history: stripSystemMessages(session.history ?? []),
            usedFallback: true,
            focusDecision: undefined,
        };
    }
}
