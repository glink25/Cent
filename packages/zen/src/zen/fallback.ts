import { t } from "../i18n";
import type { ZenContext, ZenSessionState, ZenUIStep } from "./types";

const MOCK_MIN_DELAY = 650;
const MOCK_MAX_DELAY = 1800;

export function mockLoadingDelay() {
    const delay =
        MOCK_MIN_DELAY + Math.random() * (MOCK_MAX_DELAY - MOCK_MIN_DELAY);
    return new Promise<void>((resolve) => setTimeout(resolve, delay));
}

function baseStep(
    session: ZenSessionState,
    round: number,
    intent: ZenUIStep["intent"],
) {
    return {
        stepId: `${session.id}_fallback_${round + 1}`,
        sessionId: session.id,
        intent,
        progress: {
            current: round + 1,
            max: session.journeyPlan.hardMaxSteps,
            shouldEndSoon:
                round + 1 >= session.journeyPlan.earliestEpilogueStep - 1,
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
    const topCategory = context.topCategories[0];
    return {
        ...baseStep(session, session.steps.length, "reflection"),
        mode: "interaction",
        title: t("zen-fallback-insight-default-title"),
        description: topCategory
            ? t("zen-fallback-insight-body-with-category", {
                  category: topCategory.name,
              })
            : t("zen-fallback-insight-body-calm"),
        content: topCategory
            ? [
                  {
                      type: "entityList",
                      entityType: "category",
                      ids: [topCategory.id],
                      display: "grid",
                  },
              ]
            : [],
        fields: [
            {
                id: "meaning",
                type: "longText",
                label: t("zen-fallback-input-title"),
                placeholder: t("zen-fallback-input-placeholder"),
                maxLength: 600,
            },
        ],
        submitLabel: t("zen-continue"),
        allowSkip: true,
        skipLabel: t("zen-skip"),
        directorState: {
            phase: "meaning",
            coveredDimensions: ["data_pattern"],
            openQuestion: t("zen-fallback-input-title"),
        },
    };
}

export function createFallbackEpilogueStep(
    session: ZenSessionState,
): ZenUIStep {
    return {
        ...baseStep(session, session.steps.length, "ending"),
        mode: "completion",
        title: t("zen-fallback-epilogue-title"),
        description: t("zen-fallback-epilogue-summary"),
        content: [],
        completion: {
            title: t("zen-fallback-epilogue-title"),
            quote: t("zen-fallback-epilogue-quote"),
            summary: t("zen-fallback-epilogue-summary"),
            intention: t("zen-fallback-epilogue-intention"),
            tags: ["reflection"],
        },
        directorState: {
            phase: "closing",
            coveredDimensions: session.exploration.coveredDimensions,
            insightSummary: session.exploration.insightSummary,
        },
    };
}

function createFallbackStep(
    session: ZenSessionState,
    context: ZenContext,
): ZenUIStep {
    const round = session.steps.length;
    const bills = context.candidateBills.slice(0, 3);
    if (round === 0) {
        return {
            ...baseStep(session, round, "theme_selection"),
            mode: "interaction",
            title: t("zen-fallback-theme-title"),
            description: t("zen-fallback-theme-subtitle"),
            content: bills.length
                ? [
                      {
                          type: "entityList",
                          entityType: "bill",
                          ids: bills.map((bill) => bill.id),
                          display: "list",
                      },
                  ]
                : [],
            fields: [
                {
                    id: "focus",
                    type: "singleChoice",
                    label: t("zen-fallback-theme-title"),
                    required: true,
                    options: [
                        { id: "rhythm", label: t("zen-fallback-slider-min") },
                        { id: "care", label: t("zen-fallback-slider-max") },
                        {
                            id: "observe",
                            label: t("zen-fallback-theme-reason"),
                        },
                    ],
                },
            ],
            submitLabel: t("zen-continue"),
            allowSkip: true,
            skipLabel: t("zen-skip"),
            directorState: {
                phase: "focus",
                coveredDimensions: [],
                openQuestion: t("zen-fallback-theme-title"),
            },
        };
    }
    if (round === 1) {
        return {
            ...baseStep(session, round, "reflection"),
            mode: "interaction",
            title: t("zen-fallback-slider-title"),
            description: t("zen-fallback-slider-description"),
            content: [],
            fields: [
                {
                    id: "care_level",
                    type: "slider",
                    label: t("zen-fallback-slider-title"),
                    min: 0,
                    max: 10,
                    step: 1,
                    defaultValue: 5,
                    minLabel: t("zen-fallback-slider-min"),
                    maxLabel: t("zen-fallback-slider-max"),
                },
                {
                    id: "worth_it",
                    type: "toggle",
                    label: t("zen-fallback-input-helper"),
                    defaultValue: true,
                },
            ],
            submitLabel: t("zen-place-here"),
            allowSkip: false,
            directorState: {
                phase: "meaning",
                coveredDimensions: ["data_pattern"],
                openQuestion: t("zen-fallback-slider-title"),
            },
        };
    }
    if (round < session.journeyPlan.earliestEpilogueStep - 1) {
        return createFallbackReflectionStep({ session, context });
    }
    return createFallbackEpilogueStep(session);
}

export async function createFallbackZenStep({
    session,
    context,
}: {
    session: ZenSessionState;
    context: ZenContext;
}) {
    await mockLoadingDelay();
    return createFallbackStep(session, context);
}
