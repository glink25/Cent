type PerformanceStage =
    | "network"
    | "parsed"
    | "session"
    | "commit"
    | "paint"
    | "persist"
    | "markdown";
type PerformanceEntry = {
    stage: PerformanceStage;
    at: number;
    sequence: number;
    length: number;
    duration?: number;
};
type PerformanceLog = { enabled: boolean; entries: PerformanceEntry[] };
const timing = globalThis as typeof globalThis & {
    __CHATY_PERFORMANCE__?: PerformanceLog;
};
let sequence = 0;
const sequences = new WeakMap<object, number>();

/** Opt-in diagnostics contain timing and sizes only. */
export function recordStreamTiming(
    stage: PerformanceStage,
    length: number,
    options?: { source?: object; target?: object; duration?: number },
) {
    const log = timing.__CHATY_PERFORMANCE__;
    if (!log?.enabled) return;
    const parent = options?.source ? sequences.get(options.source) : undefined;
    const entry = {
        stage,
        at: performance.now(),
        sequence: parent ?? ++sequence,
        length,
        duration: options?.duration,
    };
    if (options?.target) sequences.set(options.target, entry.sequence);
    log.entries.push(entry);
    if (log.entries.length > 5000) log.entries.splice(0, 1000);
    return entry.sequence;
}

/** Awaiting an already-resolved stream does not let the browser paint. */
export function streamBudget() {
    let started = performance.now();
    return () => {
        if (performance.now() - started < 8) return;
        return new Promise<void>((resolve) => {
            setTimeout(() => {
                started = performance.now();
                resolve();
            }, 0);
        });
    };
}
