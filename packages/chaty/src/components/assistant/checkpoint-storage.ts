import { recordStreamTiming } from "@glink25/agent-core/assistant/stream-scheduling";
import type { PersistStorage, StorageValue } from "zustand/middleware";

/** Coalesce checkpoints without overlapping writes or dropping a failed snapshot. */
export function checkpointStorage<S>(
    storage: PersistStorage<S>,
    interval = 1000,
) {
    let latest: { name: string; value: StorageValue<S> } | undefined;
    let saved: StorageValue<S> | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let writing: Promise<void> | undefined;
    let clearing: Promise<void> | undefined;
    let dirty = false;

    const schedule = () => {
        timer ??= setTimeout(() => {
            timer = undefined;
            void flush();
        }, interval);
    };
    const flush = (): Promise<void> => {
        clearTimeout(timer);
        timer = undefined;
        if (clearing) return clearing.then(flush);
        if (writing) return writing;
        writing = (async () => {
            while (dirty && latest) {
                const snapshot = latest;
                dirty = false;
                try {
                    const started = performance.now();
                    await storage.setItem(snapshot.name, snapshot.value);
                    recordStreamTiming("persist", 0, {
                        duration: performance.now() - started,
                    });
                    saved = snapshot.value;
                } catch {
                    dirty = true;
                    break;
                }
            }
        })().finally(() => {
            writing = undefined;
            if (dirty) schedule();
        });
        return writing;
    };

    return {
        flush,
        storage: {
            getItem: (name) => storage.getItem(name),
            setItem(name, value) {
                if (
                    (latest?.value ?? (clearing ? undefined : saved))?.state ===
                    value.state
                )
                    return;
                latest = { name, value };
                dirty = true;
                schedule();
            },
            async removeItem(name) {
                clearTimeout(timer);
                timer = undefined;
                latest = undefined;
                saved = undefined;
                dirty = false;
                const pending = writing;
                const removal = (async () => {
                    await pending;
                    await storage.removeItem(name);
                    saved = undefined;
                })();
                clearing = removal;
                try {
                    await removal;
                } finally {
                    clearing = undefined;
                    if (dirty) schedule();
                }
            },
        } satisfies PersistStorage<S>,
    };
}
