import { parseResult } from "./parser";
import { cloneHistory, createUserMessage } from "./shared";
import {
    createListSkillsTool,
    createListToolsTool,
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
    SkillInput,
    SystemMessage,
    Tool,
    ToolMessage, // 确保导入了 ToolMessage 类型
    TurnResult,
} from "./type";

const DEFAULT_MAX_TOOL_ROUNDS = 8;

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
}): Next {
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
    const listTool = createListToolsTool([
        ...baseTools,
        listSkillsTool,
        loadSkillTool,
    ]);

    const runtimeTools = [
        ...baseTools,
        listTool,
        listSkillsTool,
        loadSkillTool,
    ];
    const toolMap = new Map<string, Tool<any, any>>(
        runtimeTools.map((tool) => [tool.name, tool]),
    );

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
            raw: getInitialSystemPrompt([listTool, listSkillsTool]),
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
            currentRequested = provider.request({ history });

            async function* createStream(): AsyncGenerator<TurnResult> {
                yield { history: [...history] };
                const stream = await currentRequested;
                for await (const chunk of stream) {
                    const newMessages = parseResult(chunk);

                    // 找出所有需要执行的工具消息
                    const toolIndices = newMessages
                        .map((m, i) => (m.role === "tool" ? i : -1))
                        .filter((i) => i !== -1);

                    // 如果这一轮没有工具调用，直接产出结果并结束
                    if (toolIndices.length === 0) {
                        yield { history: [...history, ...newMessages] };
                        continue;
                    }

                    // 2. 并行执行当前批次的所有工具
                    const toolExecutionPromises = toolIndices.map(
                        async (idx) => {
                            const tm = newMessages[idx] as ToolMessage;
                            const startTime = Date.now();
                            try {
                                const result = await executeToolCall(
                                    toolMap,
                                    {
                                        name: tm.formatted.name,
                                        params: tm.formatted.params,
                                    },
                                    { history: [...history, ...newMessages] },
                                );
                                const runningTime = Date.now() - startTime;
                                return {
                                    ...result,
                                    formatted: {
                                        ...result.formatted,
                                        runningTime,
                                    },
                                } as ToolMessage;
                            } catch (error: any) {
                                const runningTime = Date.now() - startTime;
                                return {
                                    role: "tool",
                                    raw: `Error: ${error.message || String(error)}`,
                                    formatted: {
                                        name: tm.formatted.name,
                                        params: tm.formatted.params,
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

                    // 3. 将执行结果回填到 newMessages 中
                    toolIndices.forEach((msgIdx, i) => {
                        newMessages[msgIdx] = executedToolMessages[i];
                    });

                    const currentHistory = [...history, ...newMessages];

                    // 产出包含所有工具结果的中间状态
                    yield { history: currentHistory };

                    // 4. 关键：这一批次处理完后，仅发起一次递归请求 AI
                    const nextAbortable = start(currentHistory, round + 1);
                    subAbort = () => nextAbortable.abort();

                    const toolStream = await nextAbortable;
                    yield* toolStream;

                    subAbort = null;
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

    const next: Next = ({ message, assets }) => {
        const history = [...persistedHistory];
        const userMessage = createUserMessage(message, assets);
        history.push(userMessage);
        return start(history, 0); // 初始 round 为 0
    };

    return next;
}
