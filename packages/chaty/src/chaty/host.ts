import { z } from "zod";
import type {
    Provider,
    ProviderRequestChunk,
    SkillInput,
    Tool,
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
const hostToolDefinitions = new WeakMap<Tool, AIChatToolDefinition>();

function serializeTool(tool: Tool): AIChatToolDefinition {
    const hostDef = hostToolDefinitions.get(tool);
    if (hostDef) return hostDef;
    return {
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
        request: ({ history, configId, tools }) => {
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
        name: tool.name,
        describe: tool.describe,
        argSchema: z.unknown().describe(argDescription),
        returnSchema: z
            .unknown()
            .describe(JSON.stringify(tool.returnJsonSchema)),
        handler: (params, ctx) =>
            host.callTool({
                callId: createRequestId(),
                name: tool.name,
                params,
                history: ctx.history,
            }),
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

    return {
        provider: createHostProvider(host),
        tools: [
            ...fallback.tools,
            ...init.tools.map((tool) => createHostTool(host, tool)),
        ],
        skills: [
            ...fallback.skills,
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
