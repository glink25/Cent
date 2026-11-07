import {
    compressionBoundaries,
    contextProjection,
    estimateContextTokens,
    inputBudget,
    isContextLimitError,
    SUMMARY_PROMPT,
    sourceDigest,
    summaryRecords,
    validateToolPairs,
} from "./context";
import {
    apiRetryDelay,
    MAX_API_RETRIES,
    retryableApiError,
    waitForRetry,
} from "./recovery";
import type {
    AbortablePromise,
    ContextMetrics,
    ContextPolicy,
    ContextState,
    History,
    ProviderRequest,
    ProviderRequestChunk,
    Tool,
} from "./type";

type Request = (
    request: ProviderRequest,
) => AbortablePromise<AsyncIterable<ProviderRequestChunk>>;

class UnusableSummaryError extends Error {}

async function summarizeOnce(
    request: Request,
    history: History,
    configId: string | undefined,
    policy: ContextPolicy,
    signal: AbortSignal,
): Promise<string> {
    const cleanup = new AbortController();
    const pending = request({
        history,
        tools: [],
        configId,
        purpose: "summary",
        maxTokens: policy.maxOutputTokens ?? 8192,
    });
    let timer: ReturnType<typeof setTimeout> | undefined;
    const abort = () => pending.abort();
    signal.addEventListener("abort", abort, { once: true });
    try {
        return await Promise.race([
            (async () => {
                let answer = "";
                for await (const chunk of await pending) {
                    signal.throwIfAborted();
                    if (
                        chunk.protocolError ||
                        chunk.toolCalls?.length ||
                        chunk.finishReason === "length" ||
                        chunk.finishReason === "MAX_TOKENS"
                    )
                        throw new UnusableSummaryError(
                            "Summary was incomplete",
                        );
                    answer = chunk.answer;
                }
                signal.throwIfAborted();
                if (
                    !answer.trim() ||
                    estimateContextTokens([{ role: "user", raw: answer }], []) >
                        2400
                )
                    throw new UnusableSummaryError(
                        "Summary was empty or too long",
                    );
                return answer.trim();
            })(),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => {
                    pending.abort();
                    reject(new UnusableSummaryError("Summary timed out"));
                }, policy.summaryTimeoutMs ?? 45000);
                if (signal.aborted) reject(signal.reason);
                else
                    signal.addEventListener(
                        "abort",
                        () => reject(signal.reason),
                        { once: true, signal: cleanup.signal },
                    );
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
        signal.removeEventListener("abort", abort);
        cleanup.abort();
    }
}

async function summarize(
    ...args: Parameters<typeof summarizeOnce>
): Promise<string> {
    const signal = args[4];
    for (let retries = 0; ; retries++) {
        signal.throwIfAborted();
        try {
            return await summarizeOnce(...args);
        } catch (error) {
            signal.throwIfAborted();
            if (
                error instanceof UnusableSummaryError ||
                isContextLimitError(error) ||
                !retryableApiError(error) ||
                retries >= MAX_API_RETRIES
            )
                throw error;
            await waitForRetry(apiRetryDelay(retries + 1), signal);
        }
    }
}

export async function prepareContext({
    history,
    tools,
    policy,
    state,
    request,
    configId,
    signal,
    force = false,
}: {
    history: History;
    tools: Tool[];
    policy: ContextPolicy;
    state?: ContextState;
    request: Request;
    configId?: string;
    signal: AbortSignal;
    force?: boolean;
}): Promise<{
    history: History;
    state?: ContextState;
    metrics: ContextMetrics;
    status: "ready" | "deferred";
}> {
    const budget = inputBudget(policy);
    const limit = Math.max(1000, policy.toolResultChars ?? 12000);
    const original = contextProjection(history, state, limit);
    const originalSize = estimateContextTokens(original, tools);
    const started = Date.now();
    let next = state;
    let status: "ready" | "deferred" = "ready";
    if (force || originalSize > budget * 0.8) {
        const previousIndex = state
            ? history.findIndex((m) => m.id === state.coveredThroughId)
            : -1;
        const boundaries = compressionBoundaries(
            history,
            Math.max(1, policy.keepTurns ?? 3),
        ).filter((index) => index > previousIndex);
        let boundary = boundaries.at(-1);
        if (!force)
            for (const index of boundaries) {
                const candidate: ContextState = {
                    version: 1,
                    summary: "summary ".repeat(750),
                    coveredThroughId: history[index].id!,
                    sourceDigest: "",
                    compactions: 0,
                };
                if (
                    estimateContextTokens(
                        contextProjection(history, candidate, limit),
                        tools,
                    ) <
                    budget * 0.55
                ) {
                    boundary = index;
                    break;
                }
            }
        if (boundary !== undefined) {
            try {
                // Legacy long histories are summarized in bounded, protocol-independent record chunks.
                let cursor = previousIndex + 1;
                let summary = state?.summary ?? "";
                while (cursor <= boundary) {
                    signal.throwIfAborted();
                    let end = cursor;
                    let input: History = [];
                    while (end <= boundary) {
                        const records = summaryRecords(
                            history.slice(cursor, end + 1),
                        );
                        const candidate: History = [
                            { role: "system", raw: SUMMARY_PROMPT },
                            {
                                role: "user",
                                raw: `Previous handoff:\n${summary}\nNew historical records:\n${records}`,
                            },
                        ];
                        if (estimateContextTokens(candidate, []) > budget * 0.8)
                            break;
                        input = candidate;
                        end++;
                    }
                    if (!input.length)
                        throw new Error(
                            "A historical record exceeds the summary budget",
                        );
                    summary = await summarize(
                        request,
                        input,
                        configId,
                        policy,
                        signal,
                    );
                    cursor = end;
                }
                signal.throwIfAborted();
                next = {
                    version: 1,
                    summary,
                    coveredThroughId: history[boundary].id!,
                    sourceDigest: sourceDigest(history.slice(0, boundary + 1)),
                    compactions: (state?.compactions ?? 0) + 1,
                };
            } catch (error) {
                signal.throwIfAborted();
                // Never commit a partial/new handoff after a failed summary.
                next = state;
                status = "deferred";
                if (originalSize > budget || force)
                    throw new Error(
                        `无法整理较早对话，原始记录已保留。请重试或缩小当前请求。${error instanceof Error ? error.message : ""}`,
                    );
            }
        } else if (force)
            throw new Error(
                "当前请求已超过模型上下文容量，且没有可安全压缩的历史。请缩小单次内容或增大上下文配置。",
            );
    }
    const projected = contextProjection(history, next, limit);
    const size = estimateContextTokens(projected, tools);
    if (size > budget)
        throw new Error(
            "当前请求仍超过模型上下文预算，原始记录已保留。请缩小单次代码/文本，或增大模型上下文配置。",
        );
    validateToolPairs(projected);
    return {
        history: projected,
        state: next,
        status,
        metrics: {
            estimatedInputTokens: size,
            inputBudget: budget,
            compactions: next?.compactions ?? 0,
            ...(next !== state
                ? { summaryDurationMs: Date.now() - started }
                : {}),
        },
    };
}
