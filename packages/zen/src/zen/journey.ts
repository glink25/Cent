import type {
    ZenContext,
    ZenExplorationState,
    ZenJourneyPlan,
    ZenPost,
    ZenSessionState,
    ZenUIStep,
} from "./types";

export const ZEN_BASE_MAX_STEPS = 10;
export const ZEN_ABSOLUTE_MAX_STEPS = 12;

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSinceLastZen(
    lastZenPost: ZenPost | undefined,
    now = Date.now(),
) {
    if (!lastZenPost) return undefined;
    return Math.max(0, Math.floor((now - lastZenPost.completedAt) / DAY_MS));
}

export function targetStepsForInterval(days: number | undefined) {
    if (days === undefined) return ZEN_BASE_MAX_STEPS;
    return Math.min(
        ZEN_BASE_MAX_STEPS,
        Math.max(4, 4 + Math.floor(Math.log2(days + 1))),
    );
}

export function createZenJourneyPlan(
    lastZenPost?: ZenPost,
    now = Date.now(),
): ZenJourneyPlan {
    const days = daysSinceLastZen(lastZenPost, now);
    const targetSteps = targetStepsForInterval(days);
    return {
        daysSinceLastZen: days,
        targetSteps,
        earliestEpilogueStep: targetSteps,
        hardMaxSteps: targetSteps,
        extensionUsed: false,
    };
}

export function createZenExplorationState(): ZenExplorationState {
    return {
        phase: "focus",
        coveredDimensions: [],
        meaningfulResponseCount: 0,
        consecutiveSkips: 0,
    };
}

export function hydrateZenSession(
    session: ZenSessionState,
    lastZenPost?: ZenPost,
    now = Date.now(),
): ZenSessionState {
    return {
        ...session,
        journeyPlan:
            session.journeyPlan ?? createZenJourneyPlan(lastZenPost, now),
        exploration: session.exploration ?? createZenExplorationState(),
    };
}

export function isSkippedZenInput(input: unknown) {
    if (input === undefined || input === null || input === "") return true;
    if (input === "skip") return true;
    if (Array.isArray(input)) return input.length === 0;
    if (typeof input === "object") {
        if ("action" in input && input.action === "skip") return true;
        return Object.keys(input).length === 0;
    }
    return false;
}

export function recordZenResponse(
    exploration: ZenExplorationState,
    input: unknown,
): ZenExplorationState {
    const skipped = isSkippedZenInput(input);
    return {
        ...exploration,
        meaningfulResponseCount:
            exploration.meaningfulResponseCount + (skipped ? 0 : 1),
        consecutiveSkips: skipped ? exploration.consecutiveSkips + 1 : 0,
    };
}

export function mergeDirectorState(
    exploration: ZenExplorationState,
    step: ZenUIStep,
): ZenExplorationState {
    if (!step.directorState) return exploration;
    return {
        ...exploration,
        ...step.directorState,
        coveredDimensions: [
            ...new Set([
                ...exploration.coveredDimensions,
                ...step.directorState.coveredDimensions,
            ]),
        ],
    };
}

export function hasMinimumExploration(session: ZenSessionState) {
    return (
        session.exploration.coveredDimensions.length >= 2 &&
        session.exploration.meaningfulResponseCount >= 2
    );
}

export function hasEarlyExitReason(
    session: ZenSessionState,
    context: ZenContext,
) {
    return (
        session.exploration.consecutiveSkips >= 2 ||
        context.summary.billCount === 0
    );
}

export function canShowIntention(
    session: ZenSessionState,
    context: ZenContext,
) {
    return (
        hasMinimumExploration(session) || hasEarlyExitReason(session, context)
    );
}

export function canShowEpilogue(
    session: ZenSessionState,
    context: ZenContext,
    currentStep: number,
) {
    if (currentStep >= session.journeyPlan.hardMaxSteps) return true;
    if (hasEarlyExitReason(session, context)) return true;
    return (
        currentStep >= session.journeyPlan.earliestEpilogueStep &&
        hasMinimumExploration(session)
    );
}

export function extendZenJourney(plan: ZenJourneyPlan): ZenJourneyPlan {
    if (plan.extensionUsed) return plan;
    return {
        ...plan,
        extensionUsed: true,
        earliestEpilogueStep: Math.min(
            ZEN_ABSOLUTE_MAX_STEPS,
            plan.hardMaxSteps + 1,
        ),
        hardMaxSteps: Math.min(ZEN_ABSOLUTE_MAX_STEPS, plan.hardMaxSteps + 2),
    };
}
