import { parseResult } from "./parser";
import { cloneHistory, createUserMessage } from "./shared";
import {
    createListSkillsTool,
    createLoadSkillTool,
    executeToolCall,
    getInitialSystemPrompt,
} from "./tooling";
import type {
    AbortablePromise,
    History,
    Next,
    Provider,
    ResolvedSkill,
    Session,
    SkillInput,
    SystemMessage,
    Tool,
    ToolContext,
    ToolMessage, // 确保导入了 ToolMessage 类型
    TurnResult,
} from "./type";

const DEFAULT_MAX_TOOL_ROUNDS = 20;

export function createSession({
    history = [],
    provider,
    tools,
    skills,
    systemPrompt,
    maxToolRounds = DEFAULT_MAX_TOOL_ROUNDS,
}: {
    history?: History;
    provider: Provider;
    tools: Tool[];
    skills: SkillInput[];
    systemPrompt?: string;
    maxToolRounds?: number;
}): Session {
    const incomingHistory = cloneHistory(history);
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

    const runtimeTools: Tool<any, any>[] = [
        ...baseTools,
        listSkillsTool,
        loadSkillTool,
    ];
    const toolMap = new Map<string, Tool<any, any>>(
        runtimeTools.map((tool) => [tool.name, tool]),
    );

    // 构造工具执行上下文：除历史记录外，把本会话注册的全部工具一并暴露，
    // 这样像 playground 这样的工具可以在内部发现并调用其它工具，而无需硬编码。
    const makeCtx = (history: History): ToolContext => ({
        history,
        tools: runtimeTools,
    });

    const systemMessage = [
        ...incomingHistory.filter((m) => m.role === "system"),
        { role: "system", raw: systemPrompt ?? "" } as SystemMessage,
    ].reduce(
        (p, c) => ({
            role: "system",
            raw: `${p.raw}${c.raw.length ? `\n\nAdditional system prompt:\n${c.raw}` : ""}`,
        }),
        {
            role: "system",
            raw: getInitialSystemPrompt(),
        },
    );

    const persistedHistory = [
        systemMessage,
        ...incomingHistory.filter((m) => m.role !== "system"),
    ];

    const start = (
        history: History,
        round: number = 0,
    ): AbortablePromise<AsyncIterable<TurnResult>> => {
        let currentRequested: ReturnType<typeof provider.request>;
        let subAbort: (() => void) | null = null;

        const execute = async (): Promise<AsyncIterable<TurnResult>> => {
            // 1. 边界检查：防止无限递归
            if (round >= maxToolRounds) {
                return (async function* () {})();
            }
            currentRequested = provider.request({
                history,
                tools: runtimeTools,
            });

            async function* createStream(): AsyncGenerator<TurnResult> {
                yield { history: [...history] };
                const stream = await currentRequested;
                for await (const chunk of stream) {
                    const assistantMessage = parseResult(chunk);

                    // 找出所有需要执行的工具消息
                    const toolIndices = assistantMessage.formatted.tools ?? [];

                    // 如果这一轮没有工具调用，直接产出结果并结束
                    if (toolIndices.length === 0) {
                        yield { history: [...history, assistantMessage] };
                        continue;
                    }

                    // 2. 并行执行当前批次的所有工具
                    const toolExecutionPromises = toolIndices.map(
                        async ({ id, name, params }) => {
                            const startTime = Date.now();
                            try {
                                const result = await executeToolCall(
                                    toolMap,
                                    {
                                        name,
                                        params,
                                    },
                                    makeCtx([...history]),
                                );
                                const runningTime = Date.now() - startTime;
                                return {
                                    ...result,
                                    formatted: {
                                        ...result.formatted,
                                        // 回写原生 tool_call_id，供回传时与 assistant 调用匹配。
                                        id,
                                        runningTime,
                                    },
                                } as ToolMessage;
                            } catch (error: any) {
                                const runningTime = Date.now() - startTime;
                                return {
                                    role: "tool",
                                    raw: `Error: ${error.message || String(error)}`,
                                    formatted: {
                                        id,
                                        name: name,
                                        params: params,
                                        runningTime,
                                        errors: error.message,
                                    },
                                } as ToolMessage;
                            }
                        },
                    );

                    // 等待所有工具执行完毕
                    const executedToolMessages = await Promise.all(
                        toolExecutionPromises,
                    );

                    const currentHistory = [
                        ...history,
                        assistantMessage,
                        ...executedToolMessages,
                    ];

                    // 产出包含所有工具结果的中间状态
                    yield { history: currentHistory };

                    // 4. 关键：这一批次处理完后，仅发起一次递归请求 AI
                    const nextAbortable = start(currentHistory, round + 1);
                    subAbort = () => nextAbortable.abort();

                    const toolStream = await nextAbortable;
                    yield* toolStream;

                    subAbort = null;
                    // 原生协议下，工具调用只在流结束（finish_reason==="tool_calls"）的最终 chunk
                    // 里完整出现。处理完本批次工具后即结束当前流，由上面的递归请求继续下一轮。
                    return;
                }
            }

            return createStream();
        };

        const promise = execute() as AbortablePromise<
            AsyncIterable<TurnResult>
        >;
        promise.abort = () => {
            currentRequested?.abort?.();
            subAbort?.();
        };

        return promise;
    };

    const next = (({ message, assets }) => {
        const history = [...persistedHistory];
        const userMessage = createUserMessage(message, assets);
        history.push(userMessage);
        return start(history, 0); // 初始 round 为 0
    }) as Session;

    // 会话级能力：按消息下标在历史中定位某次工具调用并重新执行，复用统一的参数校验与分发。
    // 下标对应创建会话时传入（即界面展示）的历史数组，对话只追加、下标稳定。
    next.rerunToolCall = async (messageIndex: number) => {
        const target = incomingHistory[messageIndex];
        if (!target || target.role !== "tool") {
            throw new Error(`No tool call at history index ${messageIndex}.`);
        }
        const result = await executeToolCall(
            toolMap,
            {
                name: target.formatted.name,
                params: target.formatted.params,
            },
            makeCtx([...persistedHistory]),
        );
        if (result.formatted.errors !== undefined) {
            const err = result.formatted.errors;
            throw err instanceof Error ? err : new Error(JSON.stringify(err));
        }
        return result.formatted.returns;
    };

    return next;
}
