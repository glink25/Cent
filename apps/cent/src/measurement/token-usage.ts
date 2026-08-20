import type {
    AbortablePromise,
    History,
    Provider,
    ProviderRequest,
    ProviderRequestChunk,
    Tool,
} from "@glink25/chaty";
import { z } from "zod";
import {
    isMeasurementEnabled,
    measure,
    type TokenRange,
    type TokenUsageApiType,
} from "@/measurement";

type UsageOutcome = "completed" | "interrupted" | "failed";

type RequestUsage = {
    inputTokens: number;
    outputTokens: number;
    hasToolCalls: boolean;
    outcome: UsageOutcome;
};

type UsageAggregate = {
    apiType: TokenUsageApiType;
    inputTokens: number;
    outputTokens: number;
    requestCount: number;
};

const CJK_CHARACTER =
    /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u;

export function estimateTokenCount(text: string): number {
    let cjkCount = 0;
    let otherCount = 0;
    for (const character of text) {
        if (/\s/u.test(character)) continue;
        if (CJK_CHARACTER.test(character)) cjkCount += 1;
        else otherCount += 1;
    }
    return cjkCount + Math.ceil(otherCount / 4);
}

export function toTokenRange(tokens: number): TokenRange {
    if (tokens <= 0) return "zero";
    if (tokens < 1_000) return "lt_1k";
    if (tokens < 4_000) return "1k_4k";
    if (tokens < 16_000) return "4k_16k";
    if (tokens < 64_000) return "16k_64k";
    return "gte_64k";
}

function toRequestCountRange(
    count: number,
): "zero" | "1" | "2_3" | "4_7" | "gte_8" {
    if (count <= 0) return "zero";
    if (count === 1) return "1";
    if (count <= 3) return "2_3";
    if (count <= 7) return "4_7";
    return "gte_8";
}

export function toTokenUsageApiType(
    apiType: "open-ai-compatible" | "google-ai-studio",
): TokenUsageApiType {
    return apiType === "google-ai-studio"
        ? "google_ai_studio"
        : "open_ai_compatible";
}

function safeStringify(value: unknown): string {
    try {
        return JSON.stringify(value) ?? "";
    } catch {
        return "";
    }
}

function estimateToolTokens(tools: Tool[]): number {
    return tools.reduce((total, tool) => {
        let schema = "";
        try {
            if (tool.argSchema) {
                schema = safeStringify(
                    z.toJSONSchema(tool.argSchema as unknown as z.ZodType),
                );
            }
        } catch {
            // Non-Zod schemas are uncommon; the description still gives a useful estimate.
        }
        return (
            total +
            estimateTokenCount(`${tool.name}\n${tool.describe}\n${schema}`)
        );
    }, 0);
}

function estimateHistoryTokens(history: History): number {
    return history.reduce((total, message) => {
        if (message.role === "system") {
            return total + estimateTokenCount(message.raw);
        }
        if (message.role === "user") {
            const assetNames = message.assets?.map((file) => file.name).join();
            return (
                total + estimateTokenCount(`${assetNames ?? ""}${message.raw}`)
            );
        }
        if (message.role === "assistant") {
            return (
                total +
                estimateTokenCount(
                    `${message.formatted.answer ?? ""}${safeStringify(message.formatted.tools)}`,
                )
            );
        }
        return (
            total +
            estimateTokenCount(
                `${message.formatted.name}${safeStringify(message.formatted.params)}${safeStringify(message.formatted.returns)}${safeStringify(message.formatted.errors)}`,
            )
        );
    }, 0);
}

export function estimateRequestTokens(request: ProviderRequest): number {
    return (
        estimateHistoryTokens(request.history) +
        estimateToolTokens(request.tools)
    );
}

function estimateOutputTokens(chunk?: ProviderRequestChunk): number {
    if (!chunk) return 0;
    return estimateTokenCount(
        `${chunk.thought ?? ""}${chunk.answer ?? ""}${safeStringify(chunk.toolCalls)}`,
    );
}

function isAbortError(error: unknown) {
    return (
        (error instanceof Error && error.name === "AbortError") ||
        (typeof DOMException !== "undefined" &&
            error instanceof DOMException &&
            error.name === "AbortError")
    );
}

function observeRequest(
    provider: Provider,
    request: ProviderRequest,
    onSettled: (usage: RequestUsage) => void,
): AbortablePromise<AsyncIterable<ProviderRequestChunk>> {
    let inputTokens = 0;
    try {
        inputTokens = estimateRequestTokens(request);
    } catch {
        // Estimation is best-effort and must never affect an AI request.
    }
    let lastChunk: ProviderRequestChunk | undefined;
    let settled = false;
    const settle = (outcome: UsageOutcome) => {
        if (settled) return;
        settled = true;
        try {
            onSettled({
                inputTokens,
                outputTokens: estimateOutputTokens(lastChunk),
                hasToolCalls: Boolean(lastChunk?.toolCalls?.length),
                outcome,
            });
        } catch {
            // Telemetry failures must never alter stream completion or errors.
        }
    };

    let source: ReturnType<Provider["request"]>;
    try {
        source = provider.request(request);
    } catch (error) {
        settle(isAbortError(error) ? "interrupted" : "failed");
        throw error;
    }

    const promise = source.then(
        (iterable) => ({
            async *[Symbol.asyncIterator]() {
                try {
                    for await (const chunk of iterable) {
                        lastChunk = chunk;
                        yield chunk;
                    }
                    settle("completed");
                } catch (error) {
                    settle(isAbortError(error) ? "interrupted" : "failed");
                    throw error;
                }
            },
        }),
        (error) => {
            settle(isAbortError(error) ? "interrupted" : "failed");
            throw error;
        },
    );

    return Object.assign(promise, {
        abort: () => {
            settle("interrupted");
            source.abort();
        },
    });
}

function measureUsage(
    feature: "assistant" | "zen",
    aggregate: UsageAggregate,
    outcome: UsageOutcome,
) {
    measure("ai_token_usage", {
        feature,
        measurement: "estimated",
        api_type: aggregate.apiType,
        input_range: toTokenRange(aggregate.inputTokens),
        output_range: toTokenRange(aggregate.outputTokens),
        total_range: toTokenRange(
            aggregate.inputTokens + aggregate.outputTokens,
        ),
        request_count_range: toRequestCountRange(aggregate.requestCount),
        outcome,
    });
}

function findLastUserMessage(history: History): object | undefined {
    for (let index = history.length - 1; index >= 0; index -= 1) {
        if (history[index]?.role === "user") return history[index];
    }
    return undefined;
}

export function createAssistantTokenUsageProvider(
    provider: Provider,
    getApiType: (request: ProviderRequest) => TokenUsageApiType,
): Provider {
    if (!isMeasurementEnabled()) return provider;

    const turns = new WeakMap<object, UsageAggregate>();
    return {
        request(request) {
            const userMessage = findLastUserMessage(request.history) ?? {};
            let aggregate = turns.get(userMessage);
            if (!aggregate) {
                let apiType: TokenUsageApiType = "open_ai_compatible";
                try {
                    apiType = getApiType(request);
                } catch {
                    // Provider configuration remains the source of truth.
                }
                aggregate = {
                    apiType,
                    inputTokens: 0,
                    outputTokens: 0,
                    requestCount: 0,
                };
                turns.set(userMessage, aggregate);
                measure("assistant_request_started");
            }
            aggregate.requestCount += 1;

            return observeRequest(provider, request, (usage) => {
                aggregate.inputTokens += usage.inputTokens;
                aggregate.outputTokens += usage.outputTokens;
                if (usage.outcome !== "completed" || !usage.hasToolCalls) {
                    measureUsage("assistant", aggregate, usage.outcome);
                    turns.delete(userMessage);
                }
            });
        },
    };
}

let zenUsage: UsageAggregate | undefined;

export function beginZenTokenUsage(apiType: TokenUsageApiType) {
    if (!isMeasurementEnabled()) return;
    if (zenUsage?.requestCount) {
        measureUsage("zen", zenUsage, "interrupted");
    }
    zenUsage = {
        apiType,
        inputTokens: 0,
        outputTokens: 0,
        requestCount: 0,
    };
}

function finishZenTokenUsage(outcome: UsageOutcome, includeZero: boolean) {
    if (!zenUsage) return;
    if (includeZero || zenUsage.requestCount > 0) {
        measureUsage("zen", zenUsage, outcome);
    }
    zenUsage = undefined;
}

export function completeZenTokenUsage() {
    finishZenTokenUsage("completed", true);
}

export function interruptZenTokenUsage() {
    finishZenTokenUsage("interrupted", false);
}

export function createZenTokenUsageProvider(
    provider: Provider,
    getApiType: () => TokenUsageApiType,
): Provider {
    if (!isMeasurementEnabled()) return provider;
    return {
        request(request) {
            if (!zenUsage) {
                let apiType: TokenUsageApiType = "open_ai_compatible";
                try {
                    apiType = getApiType();
                } catch {
                    // Provider configuration remains the source of truth.
                }
                beginZenTokenUsage(apiType);
            }
            if (zenUsage) zenUsage.requestCount += 1;
            return observeRequest(provider, request, (usage) => {
                if (!zenUsage) return;
                zenUsage.inputTokens += usage.inputTokens;
                zenUsage.outputTokens += usage.outputTokens;
                if (usage.outcome !== "completed") {
                    finishZenTokenUsage(usage.outcome, true);
                }
            });
        },
    };
}
