import { z } from "zod";
import type {
    History,
    Provider,
    ProviderRequestChunk,
    SkillInput,
    Tool,
    ToolContext,
} from "./core";
import { createAbortError, withAbort } from "./core/shared";
import type {
    AIChatChildMessage,
    AIChatInitPayload,
    AIChatParentMessage,
    AIChatSkillDefinition,
    HostBridge,
} from "./types";

function errorToMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function postToParent(message: AIChatChildMessage) {
    const target =
        window.parent && window.parent !== window
            ? window.parent
            : window.opener;
    target?.postMessage(message, "*");
}

export function createPostMessageBridge(): HostBridge {
    const requestHandlers = new Map<
        string,
        {
            onChunk: (chunk: ProviderRequestChunk) => void;
            onDone: () => void;
            onError: (error: unknown) => void;
        }
    >();
    const pendingTools = new Map<
        string,
        { resolve: (value: unknown) => void; reject: (error: unknown) => void }
    >();
    const pendingSkills = new Map<
        string,
        {
            resolve: (value: AIChatSkillDefinition) => void;
            reject: (error: unknown) => void;
        }
    >();

    window.addEventListener("message", (event) => {
        const message = event.data as AIChatParentMessage;
        if (!message || typeof message !== "object") return;

        if (message.type === "cent-ai-chat:request-chunk") {
            requestHandlers.get(message.requestId)?.onChunk(message.chunk);
            return;
        }
        if (message.type === "cent-ai-chat:request-done") {
            requestHandlers.get(message.requestId)?.onDone();
            requestHandlers.delete(message.requestId);
            return;
        }
        if (message.type === "cent-ai-chat:request-error") {
            requestHandlers.get(message.requestId)?.onError(message.error);
            requestHandlers.delete(message.requestId);
            return;
        }
        if (message.type === "cent-ai-chat:tool-result") {
            const pending = pendingTools.get(message.callId);
            if (!pending) return;
            pendingTools.delete(message.callId);
            if (message.success) pending.resolve(message.result);
            else pending.reject(message.error);
            return;
        }
        if (message.type === "cent-ai-chat:skill-result") {
            const pending = pendingSkills.get(message.callId);
            if (!pending) return;
            pendingSkills.delete(message.callId);
            if (message.success && message.result)
                pending.resolve(message.result);
            else pending.reject(message.error);
        }
    });

    return {
        getInit: () =>
            new Promise<AIChatInitPayload>((resolve, reject) => {
                const timeout = window.setTimeout(() => {
                    window.removeEventListener("message", onMessage);
                    reject(new Error("AI chat host init timed out."));
                }, 10000);
                const onMessage = (
                    event: MessageEvent<AIChatParentMessage>,
                ) => {
                    if (event.data?.type !== "cent-ai-chat:init") return;
                    window.clearTimeout(timeout);
                    window.removeEventListener("message", onMessage);
                    resolve(event.data.payload);
                };
                window.addEventListener("message", onMessage);
                postToParent({ type: "cent-ai-chat:init-request" });
            }),
        requestAI(args) {
            requestHandlers.set(args.requestId, {
                onChunk: args.onChunk,
                onDone: args.onDone,
                onError: args.onError,
            });
            postToParent({
                type: "cent-ai-chat:request-ai",
                requestId: args.requestId,
                configId: args.configId,
                history: args.history,
            });
            return {
                cancel: () => {
                    postToParent({
                        type: "cent-ai-chat:request-cancel",
                        requestId: args.requestId,
                    });
                    requestHandlers.delete(args.requestId);
                },
            };
        },
        callTool(args) {
            return new Promise((resolve, reject) => {
                pendingTools.set(args.callId, { resolve, reject });
                postToParent({
                    type: "cent-ai-chat:tool-call",
                    callId: args.callId,
                    name: args.name,
                    params: args.params,
                    history: args.history,
                });
            });
        },
        loadSkill(args) {
            return new Promise((resolve, reject) => {
                const callId = crypto.randomUUID();
                pendingSkills.set(callId, { resolve, reject });
                postToParent({
                    type: "cent-ai-chat:skill-call",
                    callId,
                    id: args.id,
                });
            });
        },
    };
}

export async function resolveHostBridge(): Promise<HostBridge> {
    if (window.CentAIChatHost) {
        return window.CentAIChatHost;
    }
    return createPostMessageBridge();
}

export function createHostProvider({
    host,
    getConfigId,
}: {
    host: HostBridge;
    getConfigId: () => string | undefined;
}): Provider {
    return {
        request({ history }) {
            let settled = false;
            let handle: { cancel: () => void } | undefined;
            const chunks: ProviderRequestChunk[] = [];
            const waiters: Array<() => void> = [];
            let done = false;
            let error: unknown;

            const wake = () => {
                const pending = [...waiters];
                waiters.length = 0;
                pending.forEach((resolve) => resolve());
            };

            const promise = (async () => {
                handle = await host.requestAI({
                    requestId: crypto.randomUUID(),
                    configId: getConfigId(),
                    history,
                    onChunk: (chunk) => {
                        chunks.push(chunk);
                        wake();
                    },
                    onDone: () => {
                        done = true;
                        wake();
                    },
                    onError: (err) => {
                        error = err;
                        done = true;
                        wake();
                    },
                });
                settled = true;

                return (async function* () {
                    let index = 0;
                    while (true) {
                        while (index < chunks.length) {
                            yield chunks[index++];
                        }
                        if (error) {
                            throw new Error(errorToMessage(error));
                        }
                        if (done) break;
                        await new Promise<void>((resolve) => {
                            waiters.push(resolve);
                        });
                    }
                })();
            })();

            return withAbort(promise, () => {
                if (settled) {
                    handle?.cancel();
                } else {
                    void promise.then(() => handle?.cancel()).catch(() => {});
                }
                error = createAbortError();
                done = true;
                wake();
            });
        },
    };
}

export function createHostTools({
    host,
    definitions,
}: {
    host: HostBridge;
    definitions: AIChatInitPayload["tools"];
}): Tool[] {
    return definitions.map(
        (definition): Tool => ({
            name: definition.name,
            describe: `${definition.describe}\n\nHost arg JSON Schema: ${JSON.stringify(
                definition.argJsonSchema ?? {},
            )}`,
            argSchema: z.unknown().optional(),
            returnSchema: z
                .unknown()
                .describe(JSON.stringify(definition.returnJsonSchema)),
            handler: async (params: unknown, ctx: ToolContext) =>
                await host.callTool({
                    callId: crypto.randomUUID(),
                    name: definition.name,
                    params,
                    history: ctx.history as History,
                }),
        }),
    );
}

export function createHostSkills({
    host,
    definitions,
}: {
    host: HostBridge;
    definitions: AIChatInitPayload["skills"];
}): SkillInput[] {
    return definitions.map((definition) => ({
        id: definition.id,
        name: definition.name,
        description: definition.description,
        content: definition.content,
        loader: definition.content
            ? undefined
            : async () => {
                  if (!host.loadSkill) return "";
                  const loaded = await host.loadSkill({ id: definition.id });
                  return loaded.content ?? "";
              },
    }));
}
