import type { History } from "@/assistant";
import type { Bill } from "@/ledger/type";

export type ZenDayId = string;

type UserId = Bill["creatorId"];

export type ZenMood =
    | "calm"
    | "tired"
    | "anxious"
    | "confused"
    | "satisfied"
    | "motivated"
    | "avoidant";

export type ZenPeriod = {
    type: "daily" | "weekly" | "monthly" | "custom";
    start: number;
    end: number;
};

export type ZenTheme = {
    id: string;
    title: string;
    subtitle?: string;
    tags: string[];
};

export type ZenUIStepIntent =
    | "theme_selection"
    | "reflection"
    | "action"
    | "summary"
    | "ending";

export type ThemeSelectorCard = {
    type: "ThemeSelectorCard";
    title: string;
    subtitle?: string;
    options: ZenTheme[];
    recommendedOptionId?: string;
    reason?: string;
};

export type InsightTextCard = {
    type: "InsightTextCard";
    title: string;
    body: string;
    tone?:
        | "gentle"
        | "reflective"
        | "direct"
        | "celebratory"
        | "grounding"
        | "playful";
    relatedBillIds?: string[];
    relatedCategoryIds?: string[];
};

export type SliderCard = {
    type: "SliderCard";
    title: string;
    description?: string;
    minLabel: string;
    maxLabel: string;
    minValue: number;
    maxValue: number;
    defaultValue: number;
};

export type FreeInputCard = {
    type: "FreeInputCard";
    title: string;
    placeholder: string;
    inputMode: "text" | "voice" | "both";
    maxLength: number;
    helperText?: string;
};

export type BillFocusCard = {
    type: "BillFocusCard";
    title: string;
    description?: string;
    billIds: string[];
    displayMode: "single" | "group" | "timeline";
    question?: string;
};

export type ChoiceCardOption = {
    id: string;
    label: string;
    description?: string;
};

export type ChoiceCard = {
    type: "ChoiceCard";
    title: string;
    description?: string;
    options: ChoiceCardOption[];
    allowMultiple: boolean;
    allowSkip: boolean;
};

export type ShredderCardAction = "keep" | "pause" | "observe" | "reduce";

export type ShredderCardItem = {
    id: string;
    label: string;
    description?: string;
    amount?: number;
    categoryName?: string;
    billIds?: string[];
};

export type ShredderCard = {
    type: "ShredderCard";
    title: string;
    items: ShredderCardItem[];
    actions: ShredderCardAction[];
};

export type BudgetAdjustCard = {
    type: "BudgetAdjustCard";
    title: string;
    categoryId?: string;
    categoryName?: string;
    currentBudget: number;
    currentUsed?: number;
    suggestedBudget: number;
    reason: string;
    confirmAction: string;
};

export type IntentionCard = {
    type: "IntentionCard";
    title: string;
    suggestions: string[];
    customInputEnabled: boolean;
    duration: "day" | "week" | "month";
    reminderEnabled: boolean;
};

export type ZenEpilogueCard = {
    type: "ZenEpilogueCard";
    title: string;
    quote: string;
    summary: string;
    intention?: string;
    actions?: string[];
    shareable?: boolean;
};

export type ZenComponent =
    | ThemeSelectorCard
    | InsightTextCard
    | SliderCard
    | FreeInputCard
    | BillFocusCard
    | ChoiceCard
    | ShredderCard
    | BudgetAdjustCard
    | IntentionCard
    | ZenEpilogueCard;

export type ZenUIStep = {
    stepId: string;
    sessionId: string;
    component: ZenComponent;
    intent: ZenUIStepIntent;
    progress: {
        current: number;
        max: number;
        shouldEndSoon: boolean;
    };
    dataBindings?: {
        billIds?: string[];
        categoryIds?: string[];
        budgetIds?: string[];
        tagIds?: string[];
    };
    nextPolicy: {
        waitForUserInput: boolean;
        allowedUserActions: string[];
    };
};

export type ZenInsight = {
    id: string;
    text: string;
    tags?: string[];
};

export type ZenIntention = {
    text: string;
    duration?: "day" | "week";
};

export type ZenSessionStep = {
    stepId: string;
    componentType: ZenComponent["type"];
    aiPromptSummary: string;
    userInput?: unknown;
    relatedBillIds?: string[];
    relatedCategoryIds?: string[];
    createdAt: number;
};

export type ZenSessionState = {
    id: ZenDayId;
    bookId: string;
    userId: UserId;
    period: ZenPeriod;
    mood?: ZenMood;
    selectedTheme?: ZenTheme;
    focusDecision?: ZenFocusDecision;
    steps: ZenSessionStep[];
    extractedInsights: ZenInsight[];
    finalIntention?: ZenIntention;
    status: "active" | "completed" | "cancelled";
    currentStep?: ZenUIStep;
    history?: History;
    createdAt: number;
    updatedAt: number;
};

export type ZenPost = {
    // id 规则：`zen-${date}-${userId}`
    id: string;
    userId: UserId;
    // 该 zen 归属的日子（毫秒时间戳），用于本地 item 表的 "time" 索引排序
    time: number;
    bookId: string;
    period: ZenPeriod;
    mood?: ZenMood;
    theme?: ZenTheme;
    summary: string;
    quote: string;
    intention?: string;
    cardSummaries: string[];
    tags: string[];
    createdAt: number;
    completedAt: number;
};

export type ZenCalendarPosition = "month_start" | "month_middle" | "month_end";

export type ZenSuggestedPeriod = {
    id: string;
    label: string;
    period: ZenPeriod;
    reason: string;
};

export type ZenFocusDecision = {
    period: ZenPeriod;
    label: string;
    reason: string;
    comparisonPeriods?: ZenSuggestedPeriod[];
    focusSignals?: string[];
};

export type ZenSignalType =
    | "high_frequency_micro_spending"
    | "large_unusual_expense"
    | "subscription_leak"
    | "income_spike"
    | "category_over_budget"
    | "category_drop"
    | "healthy_balance"
    | "social_spending"
    | "self_improvement_spending"
    | "time_saving_spending"
    | "emotional_spending"
    | "planned_purchase"
    | "unplanned_purchase"
    | "flat_day";

export type ZenSignal = {
    type: ZenSignalType;
    categoryId?: string;
    categoryName?: string;
    count?: number;
    amount?: number;
    billIds?: string[];
    deviationLevel: "normal" | "mild" | "medium" | "high" | "extreme";
};

export type ZenContext = {
    zenDayId: ZenDayId;
    now: string;
    period: ZenPeriod;
    focusDecision?: ZenFocusDecision;
    recentZenPosts: ZenPost[];
    calendarPosition: ZenCalendarPosition;
    suggestedPeriods: ZenSuggestedPeriod[];
    lastZenPost?: ZenPost;
    summary: {
        expenseTotal: number;
        incomeTotal: number;
        netAmount: number;
        billCount: number;
        currency: string;
    };
    topCategories: {
        id: string;
        name: string;
        amount: number;
        count: number;
        type: "income" | "expense";
    }[];
    budgets: {
        id: string;
        title: string;
        periodStart: number;
        periodEnd: number;
        totalBudget: number;
        totalUsed: number;
        ratio: number;
        status: "normal" | "near_limit" | "over_limit";
        categories?: {
            id: string;
            name: string;
            budget: number;
            used: number;
            ratio: number;
            status: "normal" | "near_limit" | "over_limit";
        }[];
    }[];
    signals: ZenSignal[];
    candidateGroups: {
        id: string;
        label: string;
        reason: string;
        billIds: string[];
        totalAmount: number;
        categoryName?: string;
        signalType?: ZenSignalType;
    }[];
    candidateBills: {
        id: string;
        type: "income" | "expense";
        categoryId: string;
        categoryName: string;
        amount: number;
        time: number;
        comment?: string;
    }[];
};
