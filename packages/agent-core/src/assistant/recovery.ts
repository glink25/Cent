export const MAX_API_RETRIES = 5;

export function waitForRetry(ms: number, signal: AbortSignal): Promise<void> {
    signal.throwIfAborted();
    return new Promise((resolve, reject) => {
        const abort = () => {
            clearTimeout(timer);
            reject(signal.reason);
        };
        const timer = setTimeout(() => {
            signal.removeEventListener("abort", abort);
            resolve();
        }, ms);
        signal.addEventListener("abort", abort, { once: true });
    });
}

export function retryableApiError(error: unknown): boolean {
    if (error instanceof Error && error.name === "AbortError") return false;
    const status = (error as { status?: number } | null)?.status;
    return (
        status === undefined ||
        status === 408 ||
        status === 429 ||
        status >= 500
    );
}

export function reportedContextWindow(error: unknown): number | undefined {
    const match = String(error).match(
        /(?:maximum context length(?: is| of)?|context (?:window|length) (?:is|of|limit:?)|max(?:imum)? sequence length(?: is| of)?)\s*([\d,]+)\s*(?:tokens?)?/i,
    );
    const value = Number(match?.[1]?.replaceAll(",", ""));
    return Number.isSafeInteger(value) && value >= 1024 ? value : undefined;
}

export function rejectedOutputBudget(error: unknown): boolean {
    return /(?:max_tokens|max_completion_tokens|maxOutputTokens|output token limit).{0,180}(?:range|must|invalid|maximum|greater|limit|exceed)|(?:invalid|unsupported).{0,60}(?:max_tokens|max_completion_tokens|maxOutputTokens)/i.test(
        String(error),
    );
}

export const apiRetryDelay = (attempt: number) =>
    Math.min(8000, 350 * 2 ** (attempt - 1));
