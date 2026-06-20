import type { History } from "@glink25/chaty";

export type ZenDayId = string;

type UserId = string;

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

export type ZenExplorationDimension =
    | "data_pattern"
    | "context_motivation"
    | "feeling_value";

export type ZenExplorationPhase =
    | "focus"
    | "evidence"
    | "meaning"
    | "pattern"
    | "intention"
    | "closing";

export type ZenJourneyPlan = {
    daysSinceLastZen?: number;
    targetSteps: number;
    earliestEpilogueStep: number;
    hardMaxSteps: number;
    extensionUsed: boolean;
};

export type ZenExplorationState = {
    phase: ZenExplorationPhase;
    coveredDimensions: ZenExplorationDimension[];
    meaningfulResponseCount: number;
    consecutiveSkips: number;
    lastResponseSummary?: string;
    insightSummary?: string;
    openQuestion?: string;
};

export type ZenChoiceOption = {
    id: string;
    label: string;
    description?: string;
};

export type ZenContentBlock =
    | {
          type: "text";
          body: string;
          tone?: "default" | "muted";
      }
    | {
          type: "callout";
          title?: string;
          body: string;
          tone?: "gentle" | "insight" | "celebration";
      }
    | {
          type: "entityList";
          entityType: "bill" | "category" | "budget";
          ids: string[];
          title?: string;
          display?: "list" | "grid" | "timeline";
      };

type ZenFormFieldBase = {
    id: string;
    label: string;
    description?: string;
    required?: boolean;
};

export type ZenFormField =
    | (ZenFormFieldBase & {
          type: "shortText" | "longText";
          placeholder?: string;
          defaultValue?: string;
          minLength?: number;
          maxLength?: number;
      })
    | (ZenFormFieldBase & {
          type: "singleChoice" | "multiChoice" | "select";
          options: ZenChoiceOption[];
          defaultValue?: string | string[];
          minSelections?: number;
          maxSelections?: number;
      })
    | (ZenFormFieldBase & {
          type: "slider";
          min: number;
          max: number;
          step?: number;
          defaultValue: number;
          minLabel?: string;
          maxLabel?: string;
      })
    | (ZenFormFieldBase & {
          type: "rating";
          max: number;
          defaultValue?: number;
          lowLabel?: string;
          highLabel?: string;
      })
    | (ZenFormFieldBase & {
          type: "toggle";
          defaultValue?: boolean;
      });

export type ZenCompletion = {
    title: string;
    quote: string;
    summary: string;
    intention?: string;
    tags?: string[];
};

export type ZenFormValue = string | string[] | number | boolean;

export type ZenFormSubmission = {
    action: "submit" | "skip";
    values: Record<string, ZenFormValue>;
};

type ZenUIStepBase = {
    stepId: string;
    sessionId: string;
    intent: ZenUIStepIntent;
    title: string;
    description?: string;
    content: ZenContentBlock[];
    progress: {
        current: number;
        max: number;
        shouldEndSoon: boolean;
    };
    /** AI Director 的隐藏编排状态，不直接渲染。 */
    directorState?: Pick<
        ZenExplorationState,
        | "phase"
        | "coveredDimensions"
        | "lastResponseSummary"
        | "insightSummary"
        | "openQuestion"
    >;
};

export type ZenUIStep =
    | (ZenUIStepBase & {
          mode: "interaction";
          fields: ZenFormField[];
          submitLabel: string;
          allowSkip: boolean;
          skipLabel?: string;
      })
    | (ZenUIStepBase & {
          mode: "completion";
          completion: ZenCompletion;
      });

export type ZenInsight = {
    id: string;
    text: string;
    tags?: string[];
};

export type ZenIntention = {
    text: string;
    duration?: "day" | "week";
};

export type ZenBillSnapshot = {
    entityType: "bill";
    id: string;
    type: "income" | "expense";
    categoryName: string;
    amount: number;
    time: number;
    comment?: string;
};

export type ZenCategorySnapshot = {
    entityType: "category";
    id: string;
    name: string;
    amount: number;
    count: number;
    type: "income" | "expense";
};

export type ZenBudgetSnapshot = {
    entityType: "budget";
    id: string;
    title: string;
    periodStart: number;
    periodEnd: number;
    totalBudget: number;
    totalUsed: number;
    ratio: number;
    status: "normal" | "near_limit" | "over_limit";
};

export type ZenEntitySnapshot =
    | ZenBillSnapshot
    | ZenCategorySnapshot
    | ZenBudgetSnapshot;

export type ZenPostStep = {
    stepId: string;
    intent?: ZenUIStepIntent;
    component: unknown;
    userInput?: unknown;
    billSnapshots?: ZenBillSnapshot[];
    relatedBillIds?: string[];
    relatedCategoryIds?: string[];
    createdAt: number;
};

export type ZenPostStepRecord = {
    stepId: string;
    intent: ZenUIStepIntent;
    step: Extract<ZenUIStep, { mode: "interaction" }>;
    submission: ZenFormSubmission;
    summary: string;
    entitySnapshots: ZenEntitySnapshot[];
    createdAt: number;
};

export type ZenSessionStep = {
    stepId: string;
    intent: ZenUIStepIntent;
    step: Extract<ZenUIStep, { mode: "interaction" }>;
    submission: ZenFormSubmission;
    summary: string;
    entitySnapshots: ZenEntitySnapshot[];
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
    journeyPlan: ZenJourneyPlan;
    exploration: ZenExplorationState;
    status: "active" | "completed" | "cancelled";
    currentStep?: ZenUIStep;
    history?: History;
    /** 上一次已发给模型的周期类 zenContext 签名，用于只在 period 变化时重发。 */
    sentContextSignature?: string;
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
    title?: string;
    mood?: ZenMood;
    theme?: ZenTheme;
    summary: string;
    quote: string;
    intention?: string;
    stepRecords?: ZenPostStepRecord[];
    /** @deprecated Legacy card-based Zen data. */
    steps?: ZenPostStep[];
    /** @deprecated Legacy card summaries. */
    cardSummaries?: string[];
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
    habitPatterns: {
        id: string;
        label: string;
        evidence: string;
        billIds: string[];
    }[];
};
