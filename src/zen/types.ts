import type { History } from "@/assistant";

export type ZenDayId = string;

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
    userId: string | number;
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
    id: ZenDayId;
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
    | "income_spike"
    | "healthy_balance"
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
    signals: ZenSignal[];
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
