import { z } from "zod";
import type {
    ChangeProposal,
    Provider,
    ProviderRequestChunk,
    SkillInput,
    Tool,
    ToolContext,
} from "../assistant";
import { withAbort } from "../assistant/shared";
import type { RuntimeConfig } from "../components/assistant/runtime";
import { getAndroidNativeHost, getIosNativeHost } from "./native-host";
import type {
    AIChatInitPayload,
    AIChatSkillDefinition,
    AIChatToolDefinition,
    HostBridge,
    HostRequestHandle,
} from "./types";

export type { RuntimeConfig };

// host 注入工具的原始 JSON Schema（host 在 getInit 时给出）。序列化工具列表时
// 优先取这里的原值，避免经 zod 往返丢失 schema。app 内置工具则直接由 zod 推导。
const nativeBatchKey = "cent:native-batch";

const hostToolDefinitions = new WeakMap<Tool, AIChatToolDefinition>();

function serializeTool(tool: Tool): AIChatToolDefinition {
    const hostDef = hostToolDefinitions.get(tool);
    if (hostDef) return hostDef;
    return {
        exposure: tool.exposure,
        effect: tool.effect,
        endsTurn: tool.endsTurn,
        name: tool.name,
        describe: tool.describe,
        argJsonSchema: tool.argSchema
            ? (z.toJSONSchema(tool.argSchema) as Record<string, unknown>)
            : undefined,
        returnJsonSchema: z.toJSONSchema(tool.returnSchema) as Record<
            string,
            unknown
        >,
    };
}

function createRequestId() {
    return (
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    );
}

function getSameOriginParentHost(): HostBridge | undefined {
    if (window.parent === window) {
        return undefined;
    }
    try {
        return window.parent.AIChatHost;
    } catch {
        return undefined;
    }
}

export function getHostBridge(): HostBridge | undefined {
    return (
        window.AIChatHost ??
        getSameOriginParentHost() ??
        getAndroidNativeHost() ??
        getIosNativeHost()
    );
}

function createHostProvider(host: HostBridge): Provider {
    return {
        getContextPolicy: host.getContextPolicy?.bind(host),
        request: ({ history, configId, tools, purpose, maxTokens }) => {
            let handle: HostRequestHandle | undefined;
            let cancelled = false;
            let done = false;
            const queue: ProviderRequestChunk[] = [];
            let wake: (() => void) | undefined;
            let failure: unknown;

            const notify = () => {
                wake?.();
                wake = undefined;
            };

            const run = async function* () {
                const requestId = createRequestId();
                Promise.resolve(
                    host.requestAI({
                        requestId,
                        configId,
                        purpose,
                        maxTokens,
                        history,
                        tools: tools.map(serializeTool),
                        onChunk: (chunk) => {
                            queue.push(chunk);
                            notify();
                        },
                        onDone: () => {
                            done = true;
                            notify();
                        },
                        onError: (error) => {
                            failure = error;
                            done = true;
                            notify();
                        },
                    }),
                )
                    .then((nextHandle) => {
                        handle = nextHandle;
                        if (cancelled) {
                            handle.cancel();
                        }
                    })
                    .catch((error) => {
                        failure = error;
                        done = true;
                        notify();
                    });

                while (!done || queue.length > 0) {
                    if (queue.length > 0) {
                        yield queue.shift()!;
                        continue;
                    }
                    await new Promise<void>((resolve) => {
                        wake = resolve;
                    });
                }

                if (failure) {
                    throw failure;
                }
            };

            return withAbort(Promise.resolve(run()), () => {
                cancelled = true;
                done = true;
                handle?.cancel();
                notify();
            });
        },
    };
}

function createHostTool(
    host: HostBridge,
    tool: AIChatInitPayload["tools"][number],
): Tool {
    const argDescription = tool.argJsonSchema
        ? JSON.stringify(tool.argJsonSchema)
        : "No parameters";
    const runtimeTool: Tool = {
        exposure: tool.exposure ?? { native: true, code: false },
        effect: tool.effect ?? "write",
        endsTurn: tool.endsTurn,
        name: tool.name,
        describe: tool.describe,
        argSchema: z.unknown().describe(argDescription),
        returnSchema: z
            .unknown()
            .describe(JSON.stringify(tool.returnJsonSchema)),
        handler: async (params, ctx) => {
            const callId = createRequestId();
            const value = await host.callTool({
                callId,
                name: tool.name,
                params,
                history: ctx.history,
                surface: ctx.surface,
                signal: ctx.signal,
                batchId: ctx.resources?.get(nativeBatchKey) as
                    | string
                    | undefined,
            });
            const candidate = value as
                | { kind?: string; proposal?: ChangeProposal }
                | undefined;
            if (candidate?.kind !== "changeProposal" || !candidate.proposal)
                return value;
            if (!host.changeControl)
                throw new Error("Native approval is unavailable");
            const proposal = candidate.proposal;
            const decision = await ctx.approveChange?.(proposal, ctx.signal, {
                id: callId,
                name: tool.name,
            });
            const approved =
                decision?.approved === true && !ctx.signal?.aborted;
            return host.changeControl(
                {
                    operation: "decide",
                    changeId: proposal.id,
                    approved,
                    remember: approved ? decision?.remember : undefined,
                },
                approved ? ctx.signal : undefined,
            );
        },
    };
    // 记住 host 给出的原始 JSON Schema，序列化工具时直接复用，避免经 zod 往返丢失。
    hostToolDefinitions.set(runtimeTool, tool);
    return runtimeTool;
}

function createHostSkill(
    host: HostBridge,
    skill: AIChatSkillDefinition,
): SkillInput {
    if (typeof skill.content === "string") {
        return skill;
    }
    return {
        ...skill,
        loader: async () => {
            const loaded = await host.loadSkill?.({ id: skill.id });
            return loaded?.content ?? "";
        },
    };
}

export async function loadHostRuntimeConfig(
    fallback: RuntimeConfig,
): Promise<RuntimeConfig> {
    const host = getHostBridge();
    if (!host) {
        return {
            ...fallback,
            presetPrompts: fallback.presetPrompts ?? [],
            theme: fallback.theme ?? "system",
        };
    }

    const init = (await host.getInit?.()) ?? {
        configs: [],
        systemPrompt: "",
        presetPrompts: [],
        tools: [],
        skills: [],
        theme: "system" as const,
    };
    const defaultConfigId = init.configs.some(
        (config) => config.id === init.defaultConfigId,
    )
        ? init.defaultConfigId
        : init.configs[0]?.id;

    const changeControl = host.changeControl;
    const finishBatch =
        init.writeBatchSupport && host.endBatch && changeControl
            ? createHostTool(host, {
                  name: "__finishBatch",
                  describe: "Prepare the completed Playground write batch.",
                  returnJsonSchema: {},
              })
            : undefined;
    const hostSkillIds = new Set(init.skills.map((skill) => skill.id));

    return {
        scope: init.scope,
        resolveReferences: host.resolveReferences,
        undoChange: changeControl
            ? (changeId) => changeControl({ operation: "undo", changeId })
            : undefined,
        referenceDraft: init.referenceDraft,
        saveReferenceDraft: host.saveReferenceDraft,
        subscribeReferenceDeliveries: host.subscribeReferenceDeliveries,
        provider: createHostProvider({
            ...host,
            getContextPolicy:
                host.getContextPolicy ??
                ((id) => {
                    const config = init.configs.find(
                        (entry) => entry.id === (id ?? defaultConfigId),
                    );
                    return { contextWindow: config?.contextWindow };
                }),
        }),
        tools: [
            ...fallback.tools.map((tool) => {
                if (!host.endBatch || tool.name !== "playground") return tool;
                return {
                    ...tool,
                    returnSchema: finishBatch ? z.unknown() : tool.returnSchema,
                    handler: async (params: unknown, context: ToolContext) => {
                        const batchId = createRequestId();
                        const resources = new Map(context.resources);
                        resources.set(nativeBatchKey, batchId);
                        if (finishBatch)
                            resources.set("cent:native-batch-write", true);
                        try {
                            const batchContext = { ...context, resources };
                            const result = await tool.handler(
                                params,
                                batchContext,
                            );
                            if (
                                !finishBatch ||
                                !(result as { success?: boolean })?.success
                            )
                                return result;
                            context.signal?.throwIfAborted();
                            const receipt = await finishBatch.handler(
                                {},
                                batchContext,
                            );
                            return receipt && typeof receipt === "object"
                                ? { ...receipt, playgroundResult: result }
                                : result;
                        } finally {
                            host.endBatch?.(batchId);
                        }
                    },
                };
            }),
            ...init.tools.map((tool) => createHostTool(host, tool)),
        ],
        skills: [
            ...fallback.skills.filter((skill) => !hostSkillIds.has(skill.id)),
            ...init.skills.map((skill) => createHostSkill(host, skill)),
        ],
        systemPrompt: init.systemPrompt,
        configs: init.configs,
        defaultConfigId,
        presetPrompts: init.presetPrompts,
        locale: init.locale,
        theme: init.theme ?? "system",
        title: init.title,
        emptyStateSlogan: init.emptyStateSlogan,
    };
}
