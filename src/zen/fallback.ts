import { t } from "@/locale";
import type {
    ThemeSelectorCard,
    ZenContext,
    ZenSessionState,
    ZenUIStep,
} from "./types";

function buildThemeOptions(context: ZenContext) {
    const firstSignal = context.signals[0];
    const topCategory = context.topCategories[0];

    if (firstSignal?.type === "income_spike") {
        return [
            {
                id: "income-security",
                title: "收入带来的安全感",
                subtitle: "看看这段时间的流入带来了什么变化",
                tags: ["security", "income"],
            },
            {
                id: "future-allocation",
                title: "给未来留一点位置",
                subtitle: "温和地想想这笔钱可以去哪里",
                tags: ["self_investment", "abundance"],
            },
            {
                id: "effort-seen",
                title: "看见这段时间的努力",
                subtitle: "把收入背后的付出也算进来",
                tags: ["gratitude", "income"],
            },
        ];
    }

    if (firstSignal?.type === "large_unusual_expense") {
        return [
            {
                id: "money-left",
                title: "钱离开时，你得到了什么",
                subtitle: "不急着判断，只回看交换",
                tags: ["reflective", "large_expense"],
            },
            {
                id: "planned-or-comfort",
                title: "计划，还是安慰",
                subtitle: "辨认这笔支出背后的生活状态",
                tags: ["control", "emotional_compensation"],
            },
            {
                id: "future-self",
                title: "为未来的自己花钱",
                subtitle: "看看它是否在帮长期的你",
                tags: ["self_investment"],
            },
        ];
    }

    if (topCategory) {
        return [
            {
                id: "period-rhythm",
                title: `${topCategory.name}里的这段节奏`,
                subtitle: "从最明显的一类支出开始轻轻复盘",
                tags: ["reflection", topCategory.id],
            },
            {
                id: "time-exchange",
                title: "用钱购买时间",
                subtitle: "看看哪些支出替你省下了精力",
                tags: ["time_exchange"],
            },
            {
                id: "small-comfort",
                title: "小小的补偿",
                subtitle: "识别那些让这段时间好过一点的选择",
                tags: ["emotional_compensation"],
            },
        ];
    }

    return [
        {
            id: "quiet-day",
            title: "平淡里的秩序",
            subtitle: "没有明显波动，也值得被看见",
            tags: ["gratitude", "healthy_balance"],
        },
        {
            id: "future-vision",
            title: "给下一段留一点轻盈",
            subtitle: "用一个很小的意图结束这次",
            tags: ["create_intention"],
        },
        {
            id: "money-values",
            title: "这段时间的钱靠近了什么",
            subtitle: "回看支出和你重视的东西是否同向",
            tags: ["values"],
        },
    ];
}

export function createFallbackThemeStep({
    session,
    context,
}: {
    session: ZenSessionState;
    context: ZenContext;
}): ZenUIStep {
    const options = buildThemeOptions(context);
    const component: ThemeSelectorCard = {
        type: "ThemeSelectorCard",
        title: t("zen-fallback-theme-title"),
        subtitle: t("zen-fallback-theme-subtitle"),
        options,
        recommendedOptionId: options[0]?.id,
        reason: t("zen-fallback-theme-reason"),
    };
    return {
        stepId: `${session.id}-theme`,
        sessionId: session.id,
        intent: "theme_selection",
        progress: { current: 1, max: 5, shouldEndSoon: false },
        component,
        nextPolicy: {
            waitForUserInput: true,
            allowedUserActions: ["submit", "skip"],
        },
    };
}

export function createFallbackReflectionStep({
    session,
    context,
}: {
    session: ZenSessionState;
    context: ZenContext;
}): ZenUIStep {
    const round = session.steps.length + 1;
    const topCategory = context.topCategories[0];
    if (round <= 2) {
        return {
            stepId: `${session.id}-insight-${round}`,
            sessionId: session.id,
            intent: "reflection",
            progress: { current: round, max: 5, shouldEndSoon: false },
            component: {
                type: "InsightTextCard",
                title:
                    session.selectedTheme?.title ??
                    t("zen-fallback-insight-default-title"),
                body: topCategory
                    ? t("zen-fallback-insight-body-with-category", {
                          category: topCategory.name,
                      })
                    : t("zen-fallback-insight-body-calm"),
                tone: "gentle",
                relatedCategoryIds: topCategory ? [topCategory.id] : undefined,
            },
            dataBindings: {
                categoryIds: topCategory ? [topCategory.id] : undefined,
            },
            nextPolicy: {
                waitForUserInput: true,
                allowedUserActions: ["submit", "skip"],
            },
        };
    }

    if (round === 3) {
        return {
            stepId: `${session.id}-slider-${round}`,
            sessionId: session.id,
            intent: "reflection",
            progress: { current: round, max: 5, shouldEndSoon: false },
            component: {
                type: "SliderCard",
                title: t("zen-fallback-slider-title"),
                description: t("zen-fallback-slider-description"),
                minLabel: t("zen-fallback-slider-min"),
                maxLabel: t("zen-fallback-slider-max"),
                minValue: 0,
                maxValue: 100,
                defaultValue: 50,
            },
            nextPolicy: {
                waitForUserInput: true,
                allowedUserActions: ["submit", "skip"],
            },
        };
    }

    return {
        stepId: `${session.id}-input-${round}`,
        sessionId: session.id,
        intent: "reflection",
        progress: { current: round, max: 5, shouldEndSoon: true },
        component: {
            type: "FreeInputCard",
            title: t("zen-fallback-input-title"),
            placeholder: t("zen-fallback-input-placeholder"),
            inputMode: "text",
            maxLength: 160,
            helperText: t("zen-fallback-input-helper"),
        },
        nextPolicy: {
            waitForUserInput: true,
            allowedUserActions: ["submit", "skip"],
        },
    };
}

export function createFallbackEpilogueStep(
    session: ZenSessionState,
): ZenUIStep {
    return {
        stepId: `${session.id}-epilogue`,
        sessionId: session.id,
        intent: "ending",
        progress: { current: 5, max: 5, shouldEndSoon: true },
        component: {
            type: "ZenEpilogueCard",
            title: t("zen-fallback-epilogue-title"),
            quote: t("zen-fallback-epilogue-quote"),
            summary:
                session.selectedTheme?.title ??
                t("zen-fallback-epilogue-summary"),
            intention: t("zen-fallback-epilogue-intention"),
            actions: ["save_reflection"],
            shareable: false,
        },
        nextPolicy: {
            waitForUserInput: true,
            allowedUserActions: ["finish"],
        },
    };
}
