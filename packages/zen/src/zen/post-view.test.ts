import { describe, expect, it } from "vitest";
import { savedReflections } from "./post-view";
import type { ZenPost } from "./types";

describe("saved Zen compatibility", () => {
    it("projects old card summaries and input without changing the saved object", () => {
        const post = {
            steps: [
                {
                    stepId: "old",
                    component: { title: "旧记录", body: "保留" },
                    userInput: { feeling: "开心" },
                    billSnapshots: [{ amount: 123400 }],
                },
            ],
            cardSummaries: ["总结"],
        } as unknown as ZenPost;
        const before = JSON.stringify(post);
        const view = savedReflections(post);
        expect(view[0].answers).toEqual(["feeling: 开心"]);
        expect(view[0].snapshots).toEqual([{ amount: 123400 }]);
        expect(view[1].text).toEqual(["总结"]);
        expect(JSON.stringify(post)).toBe(before);
    });
    it("accepts summary-only records and malformed legacy items", () => {
        expect(savedReflections({ summary: "hello" } as ZenPost)).toEqual([]);
        expect(
            savedReflections({ steps: [null, 7] } as unknown as ZenPost),
        ).toEqual([]);
    });
    it("reads current steps without converting historical amounts", () => {
        const post = {
            stepRecords: [
                {
                    stepId: "a",
                    summary: "old",
                    step: { title: "Title", content: [] },
                    submission: { values: { x: 2 } },
                    entitySnapshots: [{ amount: 12.34 }],
                },
            ],
        } as unknown as ZenPost;
        expect(savedReflections(post)[0].snapshots).toEqual([
            { amount: 12.34 },
        ]);
    });
});
