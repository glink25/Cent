import { t } from "../i18n";
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
    ZenSessionState,
    ZenUIStep,
} from "./types";

/**
 * fallback.ts 是 Zen 的「离线 mock 编排」。
 *
 * 当真实 AI 请求失败（或本地调试没有配置 AI）时，这里会接管，
 * 用本地数据 + 预设文案模拟一次完整的 Zen 对话。它会：
 *  - 依次展示尽可能多的 UI 卡片组件（覆盖所有 ZenComponent 类型）；
 *  - 在生成下一张卡片前加入一段随机 loading，模拟真实 AI 的思考延迟；
 *  - 尽量绑定真实的账单 / 预算 / 分类数据，没有时退回到 mock 占位数据。
 */

// 模拟 AI 请求的随机延迟区间（毫秒）。
const MOCK_MIN_DELAY = 650;
const MOCK_MAX_DELAY = 2400;

// 整个 mock 流程展示的卡片总数（用于进度条）。
const MOCK_TOTAL_STEPS = 10;

function randomBetween(min: number, max: number) {
    return min + Math.random() * (max - min);
}

function pickOne<T>(items: readonly T[], fallback: T): T {
    if (items.length === 0) return fallback;
    return items[Math.floor(Math.random() * items.length)] ?? fallback;
}

/**
 * 模拟一次「AI 正在生成下一张卡片」的随机加载延迟。
 * 调用方（director）在 await 期间会把对话置为 pending，从而展示 loading。
 */
export function mockLoadingDelay() {
    const delay = randomBetween(MOCK_MIN_DELAY, MOCK_MAX_DELAY);
    return new Promise<void>((resolve) => {
        setTimeout(resolve, delay);
    });
}

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

    if (firstSignal?.type === "subscription_leak") {
        return [
            {
                id: "subscription-shredder",
                title: "悄悄流走的订阅",
                subtitle: "看看哪些自动扣费还值得留下",
                tags: ["minimalism", "subscription_leak"],
            },
            {
                id: "small-leaks",
                title: "低感知的小流失",
                subtitle: "不急着取消，先辨认它们",
                tags: ["observe_only", "minimalism"],
            },
            {
                id: "keep-what-serves",
                title: "保留真正服务你的选择",
                subtitle: "把有价值的留下，把模糊的放进观察",
                tags: ["gratitude", "cancel_or_reduce"],
            },
        ];
    }

    if (firstSignal?.type === "category_over_budget") {
        return [
            {
                id: "gentle-budget-adjust",
                title: "给预算一点呼吸",
                subtitle: "把预算当作提醒，而不是压力",
                tags: ["adjust_budget", "control"],
            },
            {
                id: "budget-trigger",
                title: "预算背后的触发点",
                subtitle: "看看是哪种生活情境推高了支出",
                tags: ["reflective", "control"],
            },
            {
                id: "smaller-next-step",
                title: "下一步只小一点点",
                subtitle: "用一个容易做到的动作收束",
                tags: ["create_intention"],
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

type StepFactoryArgs = {
    session: ZenSessionState;
    context: ZenContext;
    round: number;
};

function wrapStep(
    session: ZenSessionState,
    round: number,
    suffix: string,
    component: ZenComponent,
    options?: {
        intent?: ZenUIStep["intent"];
        allowedUserActions?: string[];
        dataBindings?: ZenUIStep["dataBindings"];
    },
): ZenUIStep {
    return {
        stepId: `${session.id}-mock-${round}-${suffix}`,
        sessionId: session.id,
        intent: options?.intent ?? "reflection",
        progress: {
            current: Math.min(round + 1, MOCK_TOTAL_STEPS),
            max: MOCK_TOTAL_STEPS,
            shouldEndSoon: round >= MOCK_TOTAL_STEPS - 2,
        },
        component,
        dataBindings: options?.dataBindings,
        nextPolicy: {
            waitForUserInput: true,
            allowedUserActions: options?.allowedUserActions ?? [
                "submit",
                "skip",
            ],
        },
    };
}

function buildThemeStep({ session, context }: StepFactoryArgs): ZenUIStep {
    const options = buildThemeOptions(context);
    const component: ThemeSelectorCard = {
        type: "ThemeSelectorCard",
        title: t("zen-fallback-theme-title"),
        subtitle: t("zen-fallback-theme-subtitle"),
        options,
        recommendedOptionId: options[0]?.id,
        reason: t("zen-fallback-theme-reason"),
    };
    return wrapStep(session, 0, "theme", component, {
        intent: "theme_selection",
    });
}

function buildInsightStep({
    session,
    context,
    round,
}: StepFactoryArgs): ZenUIStep {
    const topCategory = context.topCategories[0];
    const component: InsightTextCard = {
        type: "InsightTextCard",
        title:
            session.selectedTheme?.title ??
            t("zen-fallback-insight-default-title"),
        body: topCategory
            ? t("zen-fallback-insight-body-with-category", {
                  category: topCategory.name,
              })
            : t("zen-fallback-insight-body-calm"),
        tone: pickOne(["gentle", "reflective", "grounding"] as const, "gentle"),
        relatedCategoryIds: topCategory ? [topCategory.id] : undefined,
    };
    return wrapStep(session, round, "insight", component, {
        dataBindings: {
            categoryIds: topCategory ? [topCategory.id] : undefined,
        },
    });
}

function buildBillFocusStep({
    session,
    context,
    round,
}: StepFactoryArgs): ZenUIStep {
    const billIds = context.candidateBills.slice(0, 3).map((bill) => bill.id);
    const topCategory = context.topCategories[0];
    const component: BillFocusCard = {
        type: "BillFocusCard",
        title: "回看这几笔支出",
        description: billIds.length
            ? "不急着判断，只是和它们待一会儿。"
            : "这段时间没有特别突出的支出，留一点空白也好。",
        billIds,
        displayMode: billIds.length > 1 ? "group" : "single",
        question: topCategory
            ? `${topCategory.name}里，哪一笔最让你有感觉？`
            : "其中哪一笔，是你愿意再选一次的？",
    };
    return wrapStep(session, round, "bill-focus", component, {
        intent: "reflection",
        dataBindings: { billIds },
    });
}

function buildChoiceStep({ session, round }: StepFactoryArgs): ZenUIStep {
    const component: ChoiceCard = {
        type: "ChoiceCard",
        title: "此刻，钱给你的感受更接近哪一种？",
        description: "可以多选，没有标准答案。",
        options: [
            { id: "calm", label: "平静", description: "一切都在掌握之中" },
            { id: "tired", label: "有点累", description: "想喘口气" },
            {
                id: "satisfied",
                label: "满足",
                description: "这段时间过得还不错",
            },
            { id: "anxious", label: "隐隐不安", description: "说不上来的紧张" },
        ],
        allowMultiple: true,
        allowSkip: true,
    };
    return wrapStep(session, round, "choice", component);
}

function buildSliderStep({ session, round }: StepFactoryArgs): ZenUIStep {
    const component: SliderCard = {
        type: "SliderCard",
        title: t("zen-fallback-slider-title"),
        description: t("zen-fallback-slider-description"),
        minLabel: t("zen-fallback-slider-min"),
        maxLabel: t("zen-fallback-slider-max"),
        minValue: 0,
        maxValue: 100,
        defaultValue: 50,
    };
    return wrapStep(session, round, "slider", component, {
        allowedUserActions: ["submit"],
    });
}

function buildShredderStep({
    session,
    context,
    round,
}: StepFactoryArgs): ZenUIStep {
    const group =
        context.candidateGroups.find(
            (item) => item.signalType === "subscription_leak",
        ) ?? context.candidateGroups[0];
    const items = context.candidateBills.slice(0, 4).map((bill) => ({
        id: bill.id,
        label: bill.categoryName,
        description: bill.comment,
        amount: bill.amount,
        categoryName: bill.categoryName,
        billIds: [bill.id],
    }));
    const fallbackItems = [
        {
            id: "mock-sub-1",
            label: "流媒体会员",
            description: "每月自动续费，最近一次打开是什么时候？",
            amount: 25,
            categoryName: "订阅",
        },
        {
            id: "mock-sub-2",
            label: "云存储",
            description: "空间一直够用，但也一直在扣费",
            amount: 6,
            categoryName: "订阅",
        },
        {
            id: "mock-sub-3",
            label: "健身 App",
            description: "办卡时的热情还在吗？",
            amount: 18,
            categoryName: "健康",
        },
    ];
    const component: ShredderCard = {
        type: "ShredderCard",
        title: group?.label ? `${group.label}：留下还是放手` : "悄悄流走的订阅",
        items: items.length > 0 ? items : fallbackItems,
        actions: ["keep", "pause", "observe", "reduce"],
    };
    return wrapStep(session, round, "shredder", component, {
        intent: "action",
        dataBindings: { billIds: items.map((item) => item.id) },
    });
}

function buildBudgetAdjustStep({
    session,
    context,
    round,
}: StepFactoryArgs): ZenUIStep {
    const budget = context.budgets.find((item) => item.status !== "normal")
        ?.categories?.[0];
    const fallbackBudget = budget ?? {
        id: "mock-budget",
        name: context.topCategories[0]?.name ?? "餐饮",
        budget: 1200,
        used: 1480,
        ratio: 1.23,
        status: "over_limit" as const,
    };
    const suggested = Math.round((fallbackBudget.used * 1.1) / 10) * 10;
    const component: BudgetAdjustCard = {
        type: "BudgetAdjustCard",
        title: "给预算一点呼吸",
        categoryId:
            "id" in fallbackBudget ? (fallbackBudget.id as string) : undefined,
        categoryName: fallbackBudget.name,
        currentBudget: fallbackBudget.budget,
        currentUsed: fallbackBudget.used,
        suggestedBudget: suggested,
        reason: `${fallbackBudget.name}这段时间略微超出，把预算当作提醒而不是压力。`,
        confirmAction: "先记下来",
    };
    return wrapStep(session, round, "budget", component, {
        intent: "action",
        allowedUserActions: ["submit", "skip"],
        dataBindings: budget ? { categoryIds: [fallbackBudget.id] } : undefined,
    });
}

function buildFreeInputStep({ session, round }: StepFactoryArgs): ZenUIStep {
    const component: FreeInputCard = {
        type: "FreeInputCard",
        title: t("zen-fallback-input-title"),
        placeholder: t("zen-fallback-input-placeholder"),
        inputMode: "text",
        maxLength: 160,
        helperText: t("zen-fallback-input-helper"),
    };
    return wrapStep(session, round, "input", component);
}

function buildIntentionStep({ session, round }: StepFactoryArgs): ZenUIStep {
    const component: IntentionCard = {
        type: "IntentionCard",
        title: t("zen-fallback-intention-title"),
        suggestions: [
            t("zen-fallback-intention-suggestion-1"),
            t("zen-fallback-intention-suggestion-2"),
            t("zen-fallback-intention-suggestion-3"),
        ],
        customInputEnabled: true,
        duration: "week",
        reminderEnabled: false,
    };
    return wrapStep(session, round, "intention", component, {
        intent: "action",
    });
}

// 模拟流程的卡片顺序，覆盖所有可用的 ZenComponent 类型。
const MOCK_STEP_SEQUENCE: ((args: StepFactoryArgs) => ZenUIStep)[] = [
    buildThemeStep, // 0  ThemeSelectorCard
    buildInsightStep, // 1  InsightTextCard
    buildBillFocusStep, // 2  BillFocusCard
    buildChoiceStep, // 3  ChoiceCard
    buildSliderStep, // 4  SliderCard
    buildShredderStep, // 5  ShredderCard
    buildBudgetAdjustStep, // 6  BudgetAdjustCard
    buildFreeInputStep, // 7  FreeInputCard
    buildIntentionStep, // 8  IntentionCard
];

export function createFallbackThemeStep(args: {
    session: ZenSessionState;
    context: ZenContext;
}): ZenUIStep {
    return buildThemeStep({ ...args, round: 0 });
}

export function createFallbackReflectionStep({
    session,
    context,
}: {
    session: ZenSessionState;
    context: ZenContext;
}): ZenUIStep {
    const round = session.steps.length;
    const candidate = MOCK_STEP_SEQUENCE[round];
    const factory =
        !candidate || candidate === buildIntentionStep
            ? buildFreeInputStep
            : candidate;
    return factory({ session, context, round });
}

export function createFallbackEpilogueStep(
    session: ZenSessionState,
): ZenUIStep {
    const component: ZenEpilogueCard = {
        type: "ZenEpilogueCard",
        title: t("zen-fallback-epilogue-title"),
        quote: t("zen-fallback-epilogue-quote"),
        summary:
            session.selectedTheme?.title ?? t("zen-fallback-epilogue-summary"),
        intention:
            session.finalIntention?.text ??
            t("zen-fallback-epilogue-intention"),
        actions: ["save_reflection"],
        shareable: false,
    };
    return {
        stepId: `${session.id}-epilogue`,
        sessionId: session.id,
        intent: "ending",
        progress: {
            current: MOCK_TOTAL_STEPS,
            max: MOCK_TOTAL_STEPS,
            shouldEndSoon: true,
        },
        component,
        nextPolicy: {
            waitForUserInput: true,
            allowedUserActions: ["finish"],
        },
    };
}

/**
 * mock 编排入口：在随机 loading 之后，按 session 进度返回下一张卡片。
 * 依次走完所有卡片类型，最后落到 ZenEpilogueCard。
 */
export async function createFallbackZenStep({
    session,
    context,
}: {
    session: ZenSessionState;
    context: ZenContext;
}): Promise<ZenUIStep> {
    await mockLoadingDelay();
    const round = session.steps.length;
    const factory = MOCK_STEP_SEQUENCE[round];
    if (!factory) {
        return createFallbackEpilogueStep(session);
    }
    return factory({ session, context, round });
}
