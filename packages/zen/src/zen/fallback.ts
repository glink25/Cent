import { translate } from "../i18n";
import type { ZenLocale } from "../runtime/types";
import type {
    ZenChoiceOption,
    ZenContext,
    ZenExplorationDimension,
    ZenJourneyPlan,
    ZenSessionState,
    ZenUIStep,
} from "./types";

const MOCK_MIN_DELAY = 450;
const MOCK_MAX_DELAY = 1050;

function hash(value: string) {
    let result = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        result ^= value.charCodeAt(index);
        result = Math.imul(result, 16777619);
    }
    return result >>> 0;
}

function randomUnit(seed: string, salt: string) {
    return hash(`${seed}:${salt}`) / 0x1_0000_0000;
}

function pick<T>(seed: string, salt: string, values: readonly T[]): T {
    return values[Math.floor(randomUnit(seed, salt) * values.length)] as T;
}

function shuffled<T>(seed: string, salt: string, values: readonly T[]) {
    return [...values].sort(
        (left, right) =>
            hash(`${seed}:${salt}:${JSON.stringify(left)}`) -
            hash(`${seed}:${salt}:${JSON.stringify(right)}`),
    );
}

export function createLocalZenSeed() {
    return (
        globalThis.crypto?.randomUUID?.() ??
        `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
}

export function createLocalZenJourneyPlan(seed: string): ZenJourneyPlan {
    const targetSteps = 4 + (hash(`${seed}:length`) % 3);
    return {
        targetSteps,
        earliestEpilogueStep: targetSteps,
        hardMaxSteps: targetSteps,
        extensionUsed: false,
    };
}

export function mockLoadingDelay(seed = String(Math.random())) {
    const delay =
        MOCK_MIN_DELAY +
        randomUnit(seed, "delay") * (MOCK_MAX_DELAY - MOCK_MIN_DELAY);
    return new Promise<void>((resolve) => setTimeout(resolve, delay));
}

type LocalCopy = (key: string, values?: Record<string, unknown>) => string;

function baseStep(
    session: ZenSessionState,
    round: number,
    intent: ZenUIStep["intent"],
) {
    const seed = session.localSeed ?? session.id;
    return {
        stepId: `${session.id}_local_${round + 1}_${hash(`${seed}:${round}`).toString(36)}`,
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

function signalKind(context: ZenContext) {
    if (context.summary.billCount === 0) return "empty";
    if (context.budgets.some((budget) => budget.status === "over_limit"))
        return "budget";
    const priorities = [
        "large_unusual_expense",
        "subscription_leak",
        "high_frequency_micro_spending",
        "income_spike",
        "healthy_balance",
    ] as const;
    return (
        priorities.find((type) =>
            context.signals.some((signal) => signal.type === type),
        ) ?? "category"
    );
}

function previousValue(session: ZenSessionState, id: string) {
    for (const record of [...session.steps].reverse()) {
        const value = record.submission.values[id];
        if (value !== undefined) return value;
    }
    return undefined;
}

function options(t: LocalCopy, keys: readonly string[]): ZenChoiceOption[] {
    return keys.map((key) => ({
        id: key,
        label: t(`zen-local-option-${key}`),
    }));
}

function focusStep(
    session: ZenSessionState,
    context: ZenContext,
    t: LocalCopy,
): ZenUIStep {
    const seed = session.localSeed ?? session.id;
    const kind = signalKind(context);
    const topCategory = context.topCategories[0];
    const entityContent: ZenUIStep["content"] = topCategory
        ? [
              {
                  type: "entityList",
                  entityType: "category",
                  ids: [topCategory.id],
                  display: "grid",
              },
          ]
        : [];
    return {
        ...baseStep(session, 0, "theme_selection"),
        mode: "interaction",
        title: pick(seed, "focus-title", [
            t("zen-local-focus-title-1"),
            t("zen-local-focus-title-2"),
            t("zen-local-focus-title-3"),
        ]),
        description: t(`zen-local-focus-${kind}`, {
            category: topCategory?.name ?? t("zen-local-this-period"),
        }),
        content: entityContent,
        fields: [
            {
                id: "focus",
                type: "singleChoice",
                label: t("zen-local-focus-label"),
                required: true,
                options: shuffled(
                    seed,
                    "focus-options",
                    options(t, ["rhythm", "feeling", "choice"]),
                ),
            },
        ],
        submitLabel: t("zen-continue"),
        allowSkip: true,
        skipLabel: t("zen-skip"),
        directorState: {
            phase: "focus",
            coveredDimensions: [],
            openQuestion: t("zen-local-focus-label"),
        },
    };
}

function evidenceStep(
    session: ZenSessionState,
    context: ZenContext,
    t: LocalCopy,
): ZenUIStep {
    const seed = session.localSeed ?? session.id;
    const round = session.steps.length;
    const kind = signalKind(context);
    const focus = previousValue(session, "focus");
    const useRating = pick(seed, `evidence:${focus}`, [true, false]);
    const bills = context.candidateBills.slice(0, 3);
    return {
        ...baseStep(session, round, "reflection"),
        mode: "interaction",
        title: t(`zen-local-evidence-${kind}-title`),
        description: t("zen-local-evidence-description"),
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
        fields: useRating
            ? [
                  {
                      id: "ease",
                      type: "rating",
                      label: t("zen-local-ease-label"),
                      max: 5,
                      defaultValue: 3,
                      lowLabel: t("zen-local-ease-low"),
                      highLabel: t("zen-local-ease-high"),
                  },
              ]
            : [
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
              ],
        submitLabel: t("zen-place-here"),
        allowSkip: true,
        skipLabel: t("zen-skip"),
        directorState: {
            phase: "evidence",
            coveredDimensions: ["data_pattern", "feeling_value"],
            openQuestion: t("zen-local-ease-label"),
        },
    };
}

function meaningStep(
    session: ZenSessionState,
    context: ZenContext,
    t: LocalCopy,
): ZenUIStep {
    const seed = session.localSeed ?? session.id;
    const round = session.steps.length;
    const useText = pick(seed, `meaning:${round}`, [true, false]);
    return {
        ...baseStep(session, round, "reflection"),
        mode: "interaction",
        title: pick(seed, `meaning-title:${round}`, [
            t("zen-local-meaning-title-1"),
            t("zen-local-meaning-title-2"),
            t("zen-local-meaning-title-3"),
        ]),
        description: context.topCategories[0]
            ? t("zen-fallback-insight-body-with-category", {
                  category: context.topCategories[0].name,
              })
            : t("zen-fallback-insight-body-calm"),
        content: [],
        fields: useText
            ? [
                  {
                      id: "meaning",
                      type: "longText",
                      label: t("zen-fallback-input-title"),
                      placeholder: t("zen-fallback-input-placeholder"),
                      maxLength: 600,
                  },
              ]
            : [
                  {
                      id: "feeling",
                      type: "singleChoice",
                      label: t("zen-local-feeling-label"),
                      options: shuffled(
                          seed,
                          `feeling:${round}`,
                          options(t, [
                              "steady",
                              "relieved",
                              "tangled",
                              "curious",
                          ]),
                      ),
                  },
              ],
        submitLabel: t("zen-continue"),
        allowSkip: true,
        skipLabel: t("zen-skip"),
        directorState: {
            phase: "meaning",
            coveredDimensions: ["context_motivation", "feeling_value"],
            openQuestion: t("zen-fallback-input-title"),
        },
    };
}

function patternStep(session: ZenSessionState, t: LocalCopy): ZenUIStep {
    const round = session.steps.length;
    return {
        ...baseStep(session, round, "reflection"),
        mode: "interaction",
        title: t("zen-local-pattern-title"),
        description: t("zen-local-pattern-description"),
        content: [],
        fields: [
            {
                id: "pattern",
                type: "singleChoice",
                label: t("zen-local-pattern-label"),
                options: options(t, ["often", "sometimes", "once", "unsure"]),
            },
        ],
        submitLabel: t("zen-continue"),
        allowSkip: true,
        skipLabel: t("zen-skip"),
        directorState: {
            phase: "pattern",
            coveredDimensions: ["data_pattern", "context_motivation"],
            openQuestion: t("zen-local-pattern-label"),
        },
    };
}

function intentionStep(
    session: ZenSessionState,
    context: ZenContext,
    t: LocalCopy,
): ZenUIStep {
    const seed = session.localSeed ?? session.id;
    const round = session.steps.length;
    const kind = signalKind(context);
    const suggestionKeys =
        kind === "budget"
            ? ["pause", "notice", "keep"]
            : kind === "subscription_leak"
              ? ["review", "pause", "notice"]
              : kind === "healthy_balance"
                ? ["keep", "notice", "space"]
                : ["notice", "alternative", "keep"];
    return {
        ...baseStep(session, round, "action"),
        mode: "interaction",
        title: t("zen-fallback-intention-title"),
        description: t("zen-intention-helper"),
        content: [],
        fields: [
            {
                id: "intention",
                type: "singleChoice",
                label: t("zen-fallback-intention-title"),
                options: shuffled(
                    seed,
                    `intention:${kind}`,
                    options(t, suggestionKeys),
                ),
            },
        ],
        submitLabel: t("zen-continue"),
        allowSkip: true,
        skipLabel: t("zen-skip"),
        directorState: {
            phase: "intention",
            coveredDimensions: ["context_motivation", "feeling_value"],
            openQuestion: t("zen-fallback-intention-title"),
        },
    };
}

function completionDimension(
    session: ZenSessionState,
): ZenExplorationDimension[] {
    return session.exploration.coveredDimensions.length
        ? session.exploration.coveredDimensions
        : ["feeling_value"];
}

export function createFallbackEpilogueStep(
    session: ZenSessionState,
    context?: ZenContext,
    locale: ZenLocale = "zh",
): ZenUIStep {
    const t: LocalCopy = (key, values) => translate(locale, key, values);
    const seed = session.localSeed ?? session.id;
    const intention = previousValue(session, "intention");
    const intentionText =
        typeof intention === "string"
            ? t(`zen-local-option-${intention}`)
            : t("zen-fallback-epilogue-intention");
    const topCategory = context?.topCategories[0]?.name;
    const summary = topCategory
        ? t("zen-local-ending-summary-category", { category: topCategory })
        : t("zen-local-ending-summary-calm");
    const round = session.steps.length;
    return {
        ...baseStep(session, round, "ending"),
        mode: "completion",
        title: pick(seed, "ending-title", [
            t("zen-fallback-epilogue-title"),
            t("zen-local-ending-title-2"),
            t("zen-local-ending-title-3"),
        ]),
        description: summary,
        content: [],
        completion: {
            title: t("zen-fallback-epilogue-title"),
            quote: pick(seed, "ending-quote", [
                t("zen-fallback-epilogue-quote"),
                t("zen-local-ending-quote-2"),
                t("zen-local-ending-quote-3"),
            ]),
            summary,
            intention: intentionText,
            tags: ["reflection", "local"],
        },
        directorState: {
            phase: "closing",
            coveredDimensions: completionDimension(session),
            insightSummary: summary,
        },
    };
}

export function createFallbackReflectionStep({
    session,
    context,
    locale = "zh",
}: {
    session: ZenSessionState;
    context: ZenContext;
    locale?: ZenLocale;
}): ZenUIStep {
    const t: LocalCopy = (key, values) => translate(locale, key, values);
    return meaningStep(session, context, t);
}

export function createFallbackStep(
    session: ZenSessionState,
    context: ZenContext,
    locale: ZenLocale = "zh",
): ZenUIStep {
    const t: LocalCopy = (key, values) => translate(locale, key, values);
    const round = session.steps.length;
    const target = session.journeyPlan.hardMaxSteps;
    const shouldEndEarly = session.exploration.consecutiveSkips >= 2;
    if (shouldEndEarly || round >= target - 1)
        return createFallbackEpilogueStep(session, context, locale);
    if (round === 0) return focusStep(session, context, t);
    if (round === 1) return evidenceStep(session, context, t);
    if (round === target - 2) return intentionStep(session, context, t);
    if (target === 6 && round === 3) return patternStep(session, t);
    return meaningStep(session, context, t);
}

export async function createFallbackZenStep({
    session,
    context,
    locale = "zh",
    delay = true,
}: {
    session: ZenSessionState;
    context: ZenContext;
    locale?: ZenLocale;
    delay?: boolean;
}) {
    if (delay)
        await mockLoadingDelay(
            `${session.localSeed ?? session.id}:${session.steps.length}`,
        );
    return createFallbackStep(session, context, locale);
}
