import "../index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import type { ZenRuntimeHost } from "../runtime/types";
import type { ZenPost } from "../zen/types";

window.__ZEN_FALLBACK__ = true;

const now = Date.now();
const historyMode = new URLSearchParams(location.search).has("history");
const dayId = new Date(now).toLocaleDateString("en-CA");
const debugPost: ZenPost = {
    id: `zen-${dayId}-debug-user`,
    userId: "debug-user",
    bookId: "debug-book",
    time: now,
    period: { type: "daily", start: now - 86_400_000, end: now },
    theme: { id: "debug", title: "轻盈的一天", tags: ["debug"] },
    summary: "这是一条用于验证历史视图的 Zen 回顾。",
    quote: "慢一点，也是在向前。",
    intention: "给今天留一点空白。",
    cardSummaries: [],
    tags: ["debug"],
    createdAt: now,
    completedAt: now,
};
let debugPosts = historyMode ? [debugPost] : [];
const host: ZenRuntimeHost = {
    getInit: () => ({
        userId: "debug-user",
        bookId: "debug-book",
        scheduledTime: "00:00",
        configs: [{ id: "debug", name: "Debug" }],
        defaultConfigId: "debug",
        aiTools: [],
        locale: "zh",
        theme: "system",
    }),
    getZenContext: async ({ zenDayId, focusDecision }) => ({
        zenDayId,
        now: new Date(now).toISOString(),
        period: focusDecision?.period ?? {
            type: "daily",
            start: now - 86_400_000,
            end: now,
        },
        focusDecision,
        recentZenPosts: debugPosts,
        calendarPosition: "month_middle",
        suggestedPeriods: [],
        summary: {
            expenseTotal: 128,
            incomeTotal: 0,
            netAmount: -128,
            billCount: 3,
            currency: "CNY",
        },
        topCategories: [
            { id: "food", name: "餐饮", amount: 88, count: 2, type: "expense" },
        ],
        budgets: [],
        signals: [{ type: "healthy_balance", deviationLevel: "normal" }],
        candidateGroups: [],
        candidateBills: [],
        habitPatterns: [],
    }),
    listZenPosts: async () => debugPosts,
    mutateZenPosts: async ({ mutations }) => {
        for (const mutation of mutations) {
            if (mutation.type === "delete") {
                debugPosts = debugPosts.filter(
                    (post) => post.id !== mutation.id,
                );
            } else {
                debugPosts = [
                    ...debugPosts.filter(
                        (post) => post.id !== mutation.post.id,
                    ),
                    mutation.post,
                ];
            }
        }
    },
    requestAI: () => ({ cancel() {} }),
    callAITool: async () => {
        throw new Error("No debug AI tools");
    },
};

const element = document.getElementById("root");
if (!element) throw new Error("#root is missing");
const { Zen } = await import("../index");
createRoot(element).render(
    <StrictMode>
        <Zen host={host} />
    </StrictMode>,
);
