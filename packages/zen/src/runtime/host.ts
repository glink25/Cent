import {
    type Provider,
    type ProviderRequestChunk,
    type Tool,
    withAbort,
} from "@glink25/chaty";
import { z } from "zod";
import { getAndroidNativeHost, getIosNativeHost } from "./native-host";
import type { ZenAIToolDefinition, ZenRuntimeHost } from "./types";

const hostToolDefinitions = new WeakMap<Tool, ZenAIToolDefinition>();
const id = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function serializeTool(tool: Tool): ZenAIToolDefinition {
    const original = hostToolDefinitions.get(tool);
    if (original) return original;
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

function sameOriginParentHost() {
    if (window.parent === window) return undefined;
    try {
        return window.parent.ZenHost;
    } catch {
        return undefined;
    }
}

export function getHostBridge(): ZenRuntimeHost | undefined {
    return (
        window.ZenHost ??
        sameOriginParentHost() ??
        getAndroidNativeHost() ??
        getIosNativeHost()
    );
}

export function createHostProvider(host: ZenRuntimeHost): Provider {
    return {
        request: ({ history, configId, tools }) => {
            let handle: { cancel(): void } | undefined;
            let cancelled = false;
            let done = false;
            let failure: unknown;
            const queue: ProviderRequestChunk[] = [];
            let wake: (() => void) | undefined;
            const notify = () => {
                wake?.();
                wake = undefined;
            };
            const run = async function* () {
                const requestId = id();
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
                    .then((value) => {
                        handle = value;
                        if (cancelled) handle.cancel();
                    })
                    .catch((error) => {
                        failure = error;
                        done = true;
                        notify();
                    });
                while (!done || queue.length) {
                    if (queue.length) {
                        const chunk = queue.shift();
                        if (chunk) yield chunk;
                        continue;
                    }
                    await new Promise<void>((resolve) => {
                        wake = resolve;
                    });
                }
                if (failure) throw failure;
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

export function createHostAITool(
    host: ZenRuntimeHost,
    definition: ZenAIToolDefinition,
): Tool {
    const tool: Tool = {
        name: definition.name,
        describe: definition.describe,
        argSchema: z
            .unknown()
            .describe(JSON.stringify(definition.argJsonSchema ?? {})),
        returnSchema: z
            .unknown()
            .describe(JSON.stringify(definition.returnJsonSchema)),
        handler: (params, context) =>
            host.callAITool({
                callId: id(),
                name: definition.name,
                params,
                history: context.history,
            }),
    };
    hostToolDefinitions.set(tool, definition);
    return tool;
}

export async function loadRuntime(host: ZenRuntimeHost) {
    const init = await host.getInit();
    const reserved = new Set(["showZenStep", "decideZenFocus"]);
    const conflict = init.aiTools.find((tool) => reserved.has(tool.name));
    if (conflict)
        throw new Error(`Host AI tool name is reserved: ${conflict.name}`);
    return {
        init,
        provider: createHostProvider(host),
        aiTools: init.aiTools.map((tool) => createHostAITool(host, tool)),
    };
}

declare global {
    interface Window {
        ZenHost?: ZenRuntimeHost;
        __ZenNativeCallbacks?: Record<string, import("./types").NativeCallback>;
        CentZenNative?: { postMessage(messageJson: string): void };
        webkit?: {
            messageHandlers?: {
                CentZenNative?: {
                    postMessage(
                        message: import("./types").NativeBridgeMessage,
                    ): void;
                };
            };
        };
    }
}
