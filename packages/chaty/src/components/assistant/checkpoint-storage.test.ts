import { afterEach, describe, expect, it, vi } from "vitest";
import type { PersistStorage, StorageValue } from "zustand/middleware";
import { checkpointStorage } from "./checkpoint-storage";

type Data = { text: string };
const value = (text: string): StorageValue<Data> => ({
    state: { text },
    version: 1,
});
const deferred = () => {
    let resolve!: () => void;
    const promise = new Promise<void>((done) => {
        resolve = done;
    });
    return { promise, resolve };
};
function setup(setItem = vi.fn(async () => {})) {
    const storage = {
        getItem: vi.fn(async () => null),
        setItem,
        removeItem: vi.fn(async () => {}),
    } satisfies PersistStorage<Data>;
    return { source: storage, ...checkpointStorage(storage) };
}
afterEach(() => vi.useRealTimers());

describe("chat checkpoints", () => {
    it("coalesces continuous updates on a fixed one-second window", async () => {
        vi.useFakeTimers();
        const queue = setup();
        for (let index = 0; index < 10; index++) {
            queue.storage.setItem("chat", value(String(index)));
            await vi.advanceTimersByTimeAsync(90);
        }
        expect(queue.source.setItem).not.toHaveBeenCalled();
        await vi.advanceTimersByTimeAsync(100);
        expect(queue.source.setItem).toHaveBeenCalledExactlyOnceWith(
            "chat",
            value("9"),
        );
    });
    it("skips a runtime-only update that reuses the persisted state", async () => {
        const queue = setup();
        const snapshot = value("first");
        queue.storage.setItem("chat", snapshot);
        await queue.flush();
        queue.storage.setItem("chat", { ...snapshot });
        await queue.flush();
        expect(queue.source.setItem).toHaveBeenCalledTimes(1);
    });
    it("serializes writes and follows an in-flight write with the latest snapshot", async () => {
        const first = deferred();
        const write = vi.fn(async () => {});
        write.mockImplementationOnce(() => first.promise);
        const queue = setup(write);
        queue.storage.setItem("chat", value("first"));
        const done = queue.flush();
        queue.storage.setItem("chat", value("middle"));
        queue.storage.setItem("chat", value("last"));
        void queue.flush();
        expect(write).toHaveBeenCalledTimes(1);
        first.resolve();
        await done;
        expect(write).toHaveBeenCalledTimes(2);
        expect(write).toHaveBeenLastCalledWith("chat", value("last"));
    });
    it("retries failed writes with the most recent state", async () => {
        vi.useFakeTimers();
        const write = vi.fn(async () => {});
        write.mockRejectedValueOnce(new Error("offline"));
        const queue = setup(write);
        queue.storage.setItem("chat", value("first"));
        await queue.flush();
        queue.storage.setItem("chat", value("latest"));
        await vi.advanceTimersByTimeAsync(1000);
        expect(write).toHaveBeenLastCalledWith("chat", value("latest"));
    });
    it("can revert to the saved snapshot while a different snapshot is queued", async () => {
        const queue = setup();
        const saved = value("saved");
        queue.storage.setItem("chat", saved);
        await queue.flush();
        queue.storage.setItem("chat", value("temporary"));
        queue.storage.setItem("chat", saved);
        await queue.flush();
        expect(queue.source.setItem).toHaveBeenLastCalledWith("chat", saved);
    });
    it("waits for an in-flight write before removing storage", async () => {
        const first = deferred();
        const write = vi.fn(async () => {});
        write.mockImplementationOnce(() => first.promise);
        const queue = setup(write);
        queue.storage.setItem("chat", value("first"));
        void queue.flush();
        const removed = queue.storage.removeItem("chat");
        expect(queue.source.removeItem).not.toHaveBeenCalled();
        first.resolve();
        await removed;
        expect(queue.source.removeItem).toHaveBeenCalledExactlyOnceWith("chat");
    });
});
