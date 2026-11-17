import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { streamUpdates } from "./stream-updates";

beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) =>
        setTimeout(() => callback(performance.now()), 16),
    );
    vi.stubGlobal("cancelAnimationFrame", (id: number) => clearTimeout(id));
});
afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
});

describe("stream UI updates", () => {
    it("publishes the latest received text on the next frame", async () => {
        const commit = vi.fn();
        const updates = streamUpdates(commit);
        updates.push("one");
        updates.push("one two");
        await vi.advanceTimersByTimeAsync(16);
        expect(commit.mock.calls).toEqual([["one two"]]);
    });
    it("publishes within 50 ms even when animation frames are suspended", async () => {
        vi.stubGlobal("requestAnimationFrame", () => 999);
        const commit = vi.fn();
        const updates = streamUpdates(commit);
        for (let index = 0; index < 5; index++) {
            updates.push(index);
            await vi.advanceTimersByTimeAsync(10);
        }
        expect(commit.mock.calls).toEqual([[4]]);
    });
    it("flushes the previous text before an immediate tool or terminal event", async () => {
        const commit = vi.fn();
        const updates = streamUpdates(commit);
        updates.push("commentary");
        updates.push("approval", true);
        expect(commit.mock.calls).toEqual([["commentary"], ["approval"]]);
        await vi.advanceTimersByTimeAsync(100);
        expect(commit).toHaveBeenCalledTimes(2);
    });
    it("cancels outstanding callbacks on stop", async () => {
        const commit = vi.fn();
        const updates = streamUpdates(commit);
        updates.push("partial");
        updates.flush();
        updates.cancel();
        await vi.advanceTimersByTimeAsync(100);
        expect(commit.mock.calls).toEqual([["partial"]]);
    });
});
