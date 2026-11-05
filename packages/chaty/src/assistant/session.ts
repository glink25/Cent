import { z } from "zod";
import {
    compressionBoundaries,
    contextProjection,
    ensureMessageIds,
    estimateContextTokens,
    inputBudget,
    isContextLimitError,
    ReadConversationTool,
    validContextState,
} from "./context";
import { prepareContext } from "./context-manager";
import { parseResult } from "./parser";
import {
    apiRetryDelay,
    MAX_API_RETRIES,
    rejectedOutputBudget,
    reportedContextWindow,
    retryableApiError,
    waitForRetry,
} from "./recovery";
import { referenceTool } from "./references";
import { cloneHistory, createUserMessage } from "./shared";
import {
    createListSkillsTool,
    createLoadSkillTool,
    createTool,
    executeToolCall,
    getInitialSystemPrompt,
} from "./tooling";
import type {
    ApproveChange,
    ContextEvent,
    ContextMetrics,
    ContextPolicy,
    ContextState,
    History,
    NextInput,
    Provider,
    ProviderRequestChunk,
    ProviderToolCall,
    ReferenceResolver,
    ResolvedSkill,
    Session,
    SkillInput,
    SystemMessage,
    Tool,
    ToolContext,
    ToolMessage, // 确保导入了 ToolMessage 类型
    TurnResult,
} from "./type";

export function createSession({
    history = [],
    provider,
    tools,
    skills,
    systemPrompt,
    configId,
    contextPolicy = {},
    contextState,
    resolveReferences,
    approveChange,
}: {
    history?: History;
    provider: Provider;
    tools: Tool[];
    skills: SkillInput[];
    systemPrompt?: string;
    configId?: string;
    contextPolicy?: ContextPolicy;
    contextState?: ContextState;
    resolveReferences?: ReferenceResolver;
    approveChange?: ApproveChange;
}): Session {
    const incomingHistory = ensureMessageIds(cloneHistory(history));
    const baseTools: Tool<any, any>[] = [...tools];

    const resolvedSkills: ResolvedSkill[] = (skills ?? []).map((s) => {
        const id = (s as any).id ?? (s as any).name;
        if (typeof id !== "string" || !id.trim()) {
            throw new Error("Skill id must be a non-empty string.");
        }
        const name = (s as any).name ?? id;
        const description = (s as any).description ?? "";
        const inlineContent = (s as any).content;
        const loader = (s as any).loader;

        const load = async () => {
            if (typeof inlineContent === "string") return inlineContent;
            if (typeof loader === "function") return await loader();
            return "";
        };

        return { id, name, description, load };
    });
    const skillMap = new Map<string, ResolvedSkill>(
        resolvedSkills.map((s) => [s.id, s]),
    );

    const listSkillsTool = createListSkillsTool(resolvedSkills);
    const loadSkillTool = createLoadSkillTool(skillMap);

    const inspectImage = createTool({
        name: "inspectImage",
        describe:
            "Read a previous image attachment by its original attachment number using the current vision model.",
        exposure: { native: true, code: false },
        argSchema: z.object({
            index: z.number().int().positive(),
            question: z.string().min(1).max(2000),
        }),
        returnSchema: z.string(),
        async handler({ index, question }, { history, signal }) {
            const asset = history.flatMap((entry) =>
                entry.role === "user" ? (entry.assets ?? []) : [],
            )[index - 1];
            if (!asset?.type.startsWith("image/"))
                throw new Error("Image attachment not found");
            signal?.throwIfAborted();
            const request = provider.request({
                configId,
                tools: [],
                history: [
                    {
                        role: "user",
                        raw: question,
                        assets: [asset],
                        assetStartIndex: index,
                    },
                ],
            });
            const abort = () => request.abort();
            signal?.addEventListener("abort", abort, { once: true });
            try {
                let answer = "";
                for await (const chunk of await request) {
                    signal?.throwIfAborted();
                    if (chunk.answer) answer = chunk.answer;
                }
                if (!answer)
                    throw new Error("Image inspection returned no answer");
                return answer;
            } finally {
                signal?.removeEventListener("abort", abort);
            }
        },
    });
    const runtimeTools: Tool<any, any>[] = [
        ...baseTools,
        listSkillsTool,
        loadSkillTool,
        ReadConversationTool,
        inspectImage,
        ...(resolveReferences ? [referenceTool(resolveReferences)] : []),
    ];
    const toolMap = new Map<string, Tool<any, any>>(
        runtimeTools.map((tool) => [tool.name, tool]),
    );

    const systemMessage = [
        ...incomingHistory.filter(
            (m) =>
                m.role === "system" &&
                m.id !== "chaty-system" &&
                !m.raw.startsWith("Recoverable tool protocol error:") &&
                !m.raw.startsWith(getInitialSystemPrompt().split("\n")[0]),
        ),
        { role: "system", raw: systemPrompt ?? "" } as SystemMessage,
    ].reduce(
        (p, c) => ({
            id: "chaty-system",
            role: "system",
            raw: `${p.raw}${c.raw.length ? `\n\nAdditional system prompt:\n${c.raw}` : ""}`,
        }),
        {
            role: "system",
            id: "chaty-system",
            raw: getInitialSystemPrompt(),
        },
    );

    const persistedHistory = [
        systemMessage,
        ...incomingHistory.filter((m) => m.role !== "system"),
    ];

    const nativeTools = runtimeTools.filter((tool) => tool.exposure?.native);

    const next = (({ message, assets, references }: NextInput) => {
        const controller = new AbortController();
        let pending: ReturnType<Provider["request"]> | undefined;
        const working: History = [
            ...persistedHistory,
            ...ensureMessageIds([
                { ...createUserMessage(message, assets), references },
            ]),
        ];
        let checkpoint = validContextState(working, contextState);
        let metrics: ContextMetrics | undefined;
        let contextStatus: TurnResult["contextStatus"];
        let contextEvent: ContextEvent | undefined;
        const ctx = (call: ProviderToolCall): ToolContext => ({
            history: [...working],
            approveChange:
                approveChange &&
                ((proposal, signal) => approveChange(proposal, signal, call)),
            tools: runtimeTools,
            signal: controller.signal,
            surface: "native",
        });
        async function* run(): AsyncGenerator<TurnResult> {
            let protocolBackoff = 0;
            let apiRetries = 0;
            let forceCompaction = false;
            let recoveryHint: string | undefined;
            let outputCeiling = 32768;
            try {
                const policy = {
                    ...(await provider.getContextPolicy?.(configId)),
                    ...contextPolicy,
                };
                const baseOutput = policy.maxOutputTokens ?? 8192;
                outputCeiling = Math.max(outputCeiling, baseOutput);
                while (true) {
                    controller.signal.throwIfAborted();
                    for (const message of working)
                        message.id ??= crypto.randomUUID();
                    const coveredIndex = checkpoint
                        ? working.findIndex(
                              (m) => m.id === checkpoint?.coveredThroughId,
                          )
                        : -1;
                    const canCompact = compressionBoundaries(
                        working,
                        policy.keepTurns ?? 3,
                    ).some((i) => i > coveredIndex);
                    const requestHistory: History = recoveryHint
                        ? [...working, { role: "system", raw: recoveryHint }]
                        : working;
                    const previousCheckpoint = checkpoint;
                    const needsCompaction =
                        canCompact &&
                        (forceCompaction ||
                            estimateContextTokens(
                                contextProjection(
                                    requestHistory,
                                    checkpoint,
                                    policy.toolResultChars ?? 12000,
                                ),
                                nativeTools,
                            ) >
                                inputBudget(policy) * 0.8);
                    if (needsCompaction) {
                        const anchor =
                            working.at(-1)?.role === "user"
                                ? working.at(-2)
                                : working.at(-1);
                        contextEvent = {
                            id: crypto.randomUUID(),
                            anchorId: anchor?.id ?? working.at(-1)?.id ?? "",
                        };
                        contextStatus = "compacting";
                        yield { history: [...working], status: "running" };
                    }
                    const prepared = await prepareContext({
                        history: requestHistory,
                        tools: nativeTools,
                        policy,
                        state: checkpoint,
                        request: (params) => {
                            pending = provider.request(params);
                            return pending;
                        },
                        configId,
                        signal: controller.signal,
                        force: forceCompaction && canCompact,
                    });
                    checkpoint = prepared.state;
                    metrics = prepared.metrics;
                    contextStatus = prepared.status;
                    forceCompaction = false;
                    if (contextEvent) {
                        contextEvent =
                            checkpoint && checkpoint !== previousCheckpoint
                                ? {
                                      ...contextEvent,
                                      coveredThroughId:
                                          checkpoint.coveredThroughId,
                                      summary: checkpoint.summary,
                                  }
                                : undefined;
                        yield { history: [...working], status: "running" };
                        contextEvent = undefined;
                    }
                    let protocolError: ProviderRequestChunk["protocolError"];
                    let usage: ProviderRequestChunk["usage"];
                    let finalMessage:
                        | ReturnType<typeof parseResult>
                        | undefined;
                    const responseId = crypto.randomUUID();
                    const requestedOutput =
                        policy.maxOutputTokens ?? baseOutput;
                    try {
                        controller.signal.throwIfAborted();
                        pending = provider.request({
                            history: prepared.history,
                            tools: nativeTools,
                            configId,
                            maxTokens: requestedOutput,
                        });
                        for await (const chunk of await pending) {
                            controller.signal.throwIfAborted();
                            if (chunk.usage) usage = chunk.usage;
                            if (chunk.protocolError)
                                protocolError = chunk.protocolError;
                            if (
                                chunk.finishReason === "length" ||
                                chunk.finishReason === "MAX_TOKENS"
                            ) {
                                protocolError = {
                                    code: "OUTPUT_LENGTH",
                                    message:
                                        "Output ended before completion. Use a smaller single tool call, concise code and minimal reasoning. Split large changes into smaller steps. This incomplete batch did not execute.",
                                };
                            }
                            finalMessage = {
                                ...parseResult(chunk),
                                id: responseId,
                            };
                            if (
                                !protocolError &&
                                (chunk.answer ||
                                    chunk.thought ||
                                    chunk.toolCalls?.length ||
                                    chunk.toolProgress)
                            ) {
                                yield {
                                    history: [...working, finalMessage],
                                    status: "running",
                                    activity: chunk.toolProgress
                                        ? {
                                              phase: "preparing",
                                              messageId: responseId,
                                              callId: chunk.toolProgress.id,
                                              name: chunk.toolProgress.name,
                                          }
                                        : {
                                              phase: chunk.answer
                                                  ? "answering"
                                                  : "thinking",
                                              messageId: responseId,
                                          },
                                };
                            }
                        }
                        if (!finalMessage)
                            throw new Error("Provider returned no response");
                    } catch (error) {
                        controller.signal.throwIfAborted();
                        const contextError = isContextLimitError(error);
                        const outputRejected =
                            requestedOutput > baseOutput &&
                            rejectedOutputBudget(error);
                        if (
                            !(
                                contextError ||
                                outputRejected ||
                                retryableApiError(error)
                            ) ||
                            apiRetries >= MAX_API_RETRIES
                        )
                            throw error;
                        apiRetries++;
                        if (outputRejected) {
                            outputCeiling = baseOutput;
                            policy.maxOutputTokens = baseOutput;
                            forceCompaction = canCompact;
                        } else if (contextError) {
                            const currentWindow =
                                policy.contextWindow ?? 131072;
                            const safety = policy.safetyTokens ?? 2048;
                            const reported = reportedContextWindow(error);
                            const guessed =
                                requestedOutput +
                                safety +
                                Math.max(
                                    2048,
                                    Math.floor(
                                        prepared.metrics.estimatedInputTokens *
                                            0.85,
                                    ),
                                );
                            const smaller = Math.min(
                                currentWindow,
                                reported ?? guessed,
                            );
                            if (
                                reported &&
                                smaller - requestedOutput - safety < 2048
                            ) {
                                policy.maxOutputTokens = Math.max(
                                    1024,
                                    Math.floor((smaller - safety) / 2),
                                );
                            }
                            if (
                                smaller -
                                    (policy.maxOutputTokens ?? baseOutput) -
                                    safety <
                                1024
                            ) {
                                throw new Error(
                                    "模型可用上下文不足，请缩小当前请求或调整模型配置。",
                                );
                            }
                            policy.contextWindow = smaller;
                            forceCompaction = true;
                            if (!canCompact && smaller === currentWindow)
                                throw error;
                        }
                        yield {
                            history: [...working],
                            status: "running",
                            activeTool: "retrying_model_request",
                        };
                        await waitForRetry(
                            apiRetryDelay(apiRetries),
                            controller.signal,
                        );
                        continue;
                    }
                    apiRetries = 0;
                    if (protocolError) {
                        recoveryHint = `Recovery: ${protocolError.message} Continue the current task. Preserve earlier confirmed writes and never replay them to recover output.`;
                        if (protocolError.code === "OUTPUT_LENGTH") {
                            const window = policy.contextWindow ?? 131072;
                            const safety = policy.safetyTokens ?? 2048;
                            const observedInput = Math.max(
                                prepared.metrics.estimatedInputTokens,
                                usage?.inputTokens ?? 0,
                            );
                            const observedOutput = usage?.outputTokens;
                            // A provider may silently clamp an increased allowance. Compact rather than keep raising it.
                            if (
                                observedOutput !== undefined &&
                                requestedOutput > baseOutput &&
                                observedOutput >= baseOutput &&
                                observedOutput < requestedOutput * 0.9
                            ) {
                                outputCeiling = Math.min(
                                    outputCeiling,
                                    observedOutput,
                                );
                                policy.maxOutputTokens = outputCeiling;
                                forceCompaction = canCompact;
                            } else if (
                                observedOutput !== undefined &&
                                observedOutput < requestedOutput * 0.9 &&
                                observedInput + observedOutput >= window * 0.9
                            ) {
                                policy.contextWindow = Math.min(
                                    window,
                                    observedInput + observedOutput,
                                );
                                forceCompaction = canCompact;
                            } else {
                                const nextOutput = Math.min(
                                    outputCeiling,
                                    requestedOutput * 2,
                                    Math.floor(window / 2),
                                );
                                if (
                                    nextOutput > requestedOutput &&
                                    (canCompact ||
                                        observedInput +
                                            nextOutput +
                                            safety +
                                            512 <
                                            window)
                                ) {
                                    policy.maxOutputTokens = nextOutput;
                                    forceCompaction =
                                        canCompact &&
                                        observedInput + nextOutput + safety >
                                            window * 0.8;
                                } else {
                                    forceCompaction = canCompact;
                                }
                            }
                        } else {
                            forceCompaction = canCompact && protocolBackoff > 0;
                        }
                        yield {
                            history: [...working],
                            status: "running",
                            activeTool: "recovering_tool_call",
                        };
                        await waitForRetry(
                            Math.min(
                                4000,
                                200 * 2 ** Math.min(protocolBackoff++, 5),
                            ),
                            controller.signal,
                        );
                        continue;
                    }
                    recoveryHint = undefined;
                    protocolBackoff = 0;
                    working.push(finalMessage);
                    const calls = finalMessage.formatted.tools ?? [];
                    if (!calls.length) {
                        yield { history: [...working], status: "completed" };
                        return;
                    }
                    let ended = false;
                    // Ordered execution also prevents focus/UI and multiple writes racing.
                    for (const call of calls) {
                        controller.signal.throwIfAborted();
                        yield {
                            history: [...working],
                            status: "running",
                            activeTool: call.name,
                            activity: {
                                phase: "executing",
                                callId: call.id,
                                name: call.name,
                                params: call.params,
                                messageId: finalMessage.id,
                            },
                        };
                        const started = Date.now();
                        const result: ToolMessage = ended
                            ? {
                                  role: "tool",
                                  raw: "Turn already ended",
                                  formatted: {
                                      name: call.name,
                                      params: call.params,
                                      errors: {
                                          message:
                                              "Turn already ended; call was not executed",
                                      },
                                  },
                              }
                            : await executeToolCall(toolMap, call, ctx(call));
                        result.id = crypto.randomUUID();
                        result.formatted.id = call.id;
                        result.formatted.runningTime = Date.now() - started;
                        working.push(result);
                        if (
                            controller.signal.aborted &&
                            toolMap.get(call.name)?.effect === "write"
                        ) {
                            yield { history: [...working], status: "running" };
                        }
                        controller.signal.throwIfAborted();
                        if (
                            !result.formatted.errors &&
                            toolMap.get(call.name)?.endsTurn
                        )
                            ended = true;
                        yield { history: [...working], status: "running" };
                    }
                    if (ended) {
                        yield { history: [...working], status: "completed" };
                        return;
                    }
                }
            } catch (error) {
                const lastAssistantIndex = working.findLastIndex(
                    (m) => m.role === "assistant",
                );
                const assistant = working[lastAssistantIndex];
                if (
                    assistant?.role === "assistant" &&
                    lastAssistantIndex >
                        working.findLastIndex((m) => m.role === "user")
                ) {
                    const completedIds = new Set(
                        working
                            .slice(lastAssistantIndex + 1)
                            .flatMap((m) =>
                                m.role === "tool" ? [m.formatted.id] : [],
                            ),
                    );
                    for (const call of assistant.formatted.tools ?? []) {
                        if (!completedIds.has(call.id))
                            working.push({
                                role: "tool",
                                internal: true,
                                raw: "Execution interrupted; inspect state before retrying writes",
                                formatted: {
                                    id: call.id,
                                    name: call.name,
                                    params: call.params,
                                    errors: {
                                        message:
                                            "Execution interrupted; inspect state before retrying writes",
                                    },
                                },
                            });
                    }
                }
                yield {
                    history: [...working],
                    status: controller.signal.aborted ? "cancelled" : "failed",
                };
                throw error;
            }
        }
        async function* stream(): AsyncGenerator<TurnResult> {
            for await (const result of run()) {
                for (const message of result.history)
                    message.id ??= crypto.randomUUID();
                yield {
                    ...result,
                    contextState: checkpoint,
                    contextEvent,
                    contextStatus,
                    contextMetrics: metrics,
                };
            }
        }
        const promise = Object.assign(Promise.resolve(stream()), {
            abort: () => {},
        });
        promise.abort = () => {
            controller.abort();
            pending?.abort();
        };
        return promise;
    }) as unknown as Session;

    next.rerunToolCall = async (messageIndex: number) => {
        const target = incomingHistory[messageIndex];
        if (!target || target.role !== "tool")
            throw new Error("No tool call at this index");
        const tool = toolMap.get(target.formatted.name);
        if (!tool || tool.effect !== "read")
            throw new Error("Only read-only tools can be replayed");
        const result = await executeToolCall(toolMap, target.formatted, {
            history: [...persistedHistory],
            tools: runtimeTools,
            surface: "native",
        });
        if (result.formatted.errors !== undefined)
            throw new Error(JSON.stringify(result.formatted.errors));
        return result.formatted.returns;
    };
    return next;
}
