import { type Provider, withAbort } from "@glink25/chaty";
import { describe, expect, it, vi } from "vitest";
import { resolveZenDirectorConfig } from "../runtime/model";
import { requestNextZenStep } from "./director";
import { createFallbackStep, createLocalZenJourneyPlan } from "./fallback";
import {
    createZenExplorationState,
    mergeDirectorState,
    recordZenResponse,
} from "./journey";
import type {
    ZenContext,
    ZenFormSubmission,
    ZenSessionState,
    ZenUIStep,
} from "./types";

function context(overrides: Partial<ZenContext> = {}): ZenContext {
    const now = Date.now();
    return {
        zenDayId: "2026-06-20",
        now: new Date(now).toISOString(),
        period: { type: "daily", start: now - 86_400_000, end: now },
        recentZenPosts: [],
        calendarPosition: "month_middle",
        suggestedPeriods: [],
        summary: {
            expenseTotal: 128,
            incomeTotal: 0,
            netAmount: -128,
            billCount: 2,
            currency: "CNY",
        },
        topCategories: [
            {
                id: "food",
                name: "餐饮",
                amount: 128,
                count: 2,
                type: "expense",
            },
        ],
        budgets: [],
        signals: [{ type: "healthy_balance", deviationLevel: "normal" }],
        candidateGroups: [],
        candidateBills: [
            {
                id: "bill-1",
                type: "expense",
                categoryId: "food",
                categoryName: "餐饮",
                amount: 68,
                time: now,
            },
        ],
        habitPatterns: [],
        ...overrides,
    };
}

function session(seed: string): ZenSessionState {
    return {
        id: "2026-06-20",
        bookId: "book",
        userId: "user",
        period: context().period,
        steps: [],
        extractedInsights: [],
        journeyPlan: createLocalZenJourneyPlan(seed),
        exploration: createZenExplorationState(),
        status: "active",
        localSeed: seed,
        createdAt: 1,
        updatedAt: 1,
    };
}

function answer(
    current: ZenSessionState,
    step: Extract<ZenUIStep, { mode: "interaction" }>,
    submission: ZenFormSubmission = { action: "submit", values: {} },
) {
    return {
        ...current,
        currentStep: step,
        exploration: recordZenResponse(
            mergeDirectorState(current.exploration, step),
            submission,
        ),
        steps: [
            ...current.steps,
            {
                stepId: step.stepId,
                intent: step.intent,
                step,
                submission,
                summary: "test",
                entitySnapshots: [],
                createdAt: current.steps.length + 1,
            },
        ],
    } satisfies ZenSessionState;
}

function run(seed: string, zenContext = context()) {
    let current = session(seed);
    const steps: ZenUIStep[] = [];
    while (steps.length < 8) {
        const step = createFallbackStep(current, zenContext);
        steps.push(step);
        if (step.mode === "completion") break;
        current = answer(current, step);
    }
    return steps;
}

describe("local Zen director", () => {
    it("keeps a seeded journey deterministic and between four and six steps", () => {
        const first = run("steady-seed");
        const second = run("steady-seed");

        expect(second).toEqual(first);
        expect(first.length).toBeGreaterThanOrEqual(4);
        expect(first.length).toBeLessThanOrEqual(6);
        expect(first.at(-1)?.mode).toBe("completion");
        expect(new Set(first.map((step) => step.stepId)).size).toBe(
            first.length,
        );
    });

    it("changes the journey when a new seed is created", () => {
        expect(run("first-seed")).not.toEqual(run("second-seed"));
    });

    it("uses budget context without inventing a transaction claim", () => {
        const budgetContext = context({
            budgets: [
                {
                    id: "food-budget",
                    title: "餐饮预算",
                    periodStart: 1,
                    periodEnd: 2,
                    totalBudget: 100,
                    totalUsed: 128,
                    ratio: 1.28,
                    status: "over_limit",
                },
            ],
        });
        const first = createFallbackStep(session("budget"), budgetContext);
        expect(first.description).toContain("预算");
    });

    it("ends early after two consecutive skips", () => {
        let current = session("skip-seed");
        const zenContext = context();
        for (let index = 0; index < 2; index += 1) {
            const step = createFallbackStep(current, zenContext);
            expect(step.mode).toBe("interaction");
            if (step.mode === "interaction") {
                current = answer(current, step, {
                    action: "skip",
                    values: {},
                });
            }
        }
        expect(createFallbackStep(current, zenContext).mode).toBe("completion");
    });

    it("keeps an empty ledger reflective for four to six steps", () => {
        const empty = context({
            summary: {
                expenseTotal: 0,
                incomeTotal: 0,
                netAmount: 0,
                billCount: 0,
                currency: "CNY",
            },
            topCategories: [],
            candidateBills: [],
            signals: [],
        });
        const steps = run("empty", empty);
        expect(steps.length).toBeGreaterThanOrEqual(4);
        expect(steps.length).toBeLessThanOrEqual(6);
        expect(steps.at(-1)?.mode).toBe("completion");
    });

    it("never calls the provider in local mode", async () => {
        let requests = 0;
        const provider: Provider = {
            request: () => {
                requests += 1;
                return withAbort(
                    Promise.reject(new Error("provider must stay idle")),
                    () => {},
                );
            },
        };
        const result = await requestNextZenStep({
            session: session("offline"),
            context: context(),
            provider,
            hostTools: [],
            directorMode: "local",
        });

        expect(result.usedFallback).toBe(true);
        expect(requests).toBe(0);
    });

    it("does not turn an AI provider failure into a local journey", async () => {
        vi.stubGlobal("window", globalThis);
        const provider: Provider = {
            request: () =>
                withAbort(
                    Promise.reject(new Error("AI unavailable")),
                    () => {},
                ),
        };

        await expect(
            requestNextZenStep({
                session: session("online"),
                context: context(),
                provider,
                hostTools: [],
                directorMode: "ai",
            }),
        ).rejects.toThrow("AI unavailable");
        vi.unstubAllGlobals();
    });
});

describe("Zen model selection", () => {
    const configs = [{ id: "default" }, { id: "chosen" }];

    it("keeps an explicit no-model selection local", () => {
        expect(
            resolveZenDirectorConfig({
                configs,
                aiConfigId: null,
                defaultConfigId: "default",
            }),
        ).toEqual({ directorMode: "local" });
    });

    it("supports following the default and choosing a model", () => {
        expect(
            resolveZenDirectorConfig({ configs, defaultConfigId: "default" }),
        ).toEqual({ directorMode: "ai", configId: "default" });
        expect(
            resolveZenDirectorConfig({
                configs,
                aiConfigId: "chosen",
                defaultConfigId: "default",
            }),
        ).toEqual({ directorMode: "ai", configId: "chosen" });
    });

    it("uses local mode when no valid configuration exists", () => {
        expect(resolveZenDirectorConfig({ configs: [] })).toEqual({
            directorMode: "local",
        });
    });
});
