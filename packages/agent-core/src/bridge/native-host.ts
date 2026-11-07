import type {
    ChangeReceipt,
    History,
    ProviderRequestChunk,
} from "../assistant";
import { createAgentId as createRequestId } from "../assistant/id";
import { formatUserReferences } from "../assistant/references";
import { withToolImages } from "../assistant/tool-images";
import { encodeImages, isImage } from "../providers/images";
import type { ReferenceDelivery } from "./runtime";
import type {
    AIChatInitPayload,
    HostBridge,
    HostRequestHandle,
    NativeBridgeMessage,
    NativeCallback,
} from "./types";
import { AGENT_BRIDGE_VERSION } from "./types";

/**
 * Native bridge adapter。
 *
 * 把 Android `addJavascriptInterface` 与 iOS `messageHandlers` 两种 native
 * 注入方式收敛成标准 `HostBridge`，让聊天核心 / assistant core / tool 执行逻辑
 * 完全不感知平台差异。新增 native 后端时只需要新增一个 `getXxxNativeHost`。
 */

/** 确保 callback store 存在并返回。 */
function ensureNativeCallbackStore(): Record<string, NativeCallback> {
    if (!window.__AIChatNativeCallbacks) {
        window.__AIChatNativeCallbacks = {};
    }
    return window.__AIChatNativeCallbacks;
}

/** 把任意 native 回传的错误标准化为 `Error`。 */
export function nativeError(error: unknown): Error {
    if (error instanceof Error) return error;
    if (typeof error === "object" && error && "message" in error) {
        return new Error(String((error as { message: unknown }).message));
    }
    return new Error(String(error ?? "Native bridge error"));
}

/** native 侧发送 message 的统一抽象。 */
type NativeTransport = (message: NativeBridgeMessage) => void;

/**
 * 注册一个一次性 callback（resolve / reject），发送 message 给 native，
 * 返回一个 Promise。用于 `getInit` 与 `callTool` 这类请求-响应语义。
 */
function nativePromise<T>(
    transport: NativeTransport,
    build: (id: string) => NativeBridgeMessage,
    id = createRequestId(),
): Promise<T> {
    const store = ensureNativeCallbackStore();
    return new Promise<T>((resolve, reject) => {
        store[id] = {
            resolve: (value) => {
                delete store[id];
                resolve(value as T);
            },
            reject: (error) => {
                delete store[id];
                reject(nativeError(error));
            },
        };
        try {
            transport(build(id));
        } catch (error) {
            delete store[id];
            reject(nativeError(error));
        }
    });
}

async function encodeNativeHistory(history: History): Promise<unknown[]> {
    const imagesByMessage = history.map((message) =>
        message.role === "user" ? (message.assets ?? []).filter(isImage) : [],
    );
    const images = await encodeImages(imagesByMessage.flat());
    let offset = 0;
    return history.map((message, index) => {
        if (message.role !== "user") return message;
        const count = imagesByMessage[index].length;
        const assets = [
            ...images.slice(offset, offset + count),
            ...(message.toolImages ?? []),
        ];
        offset += count;
        const { references: _, toolImages: __, ...content } = message;
        return { ...content, raw: formatUserReferences(message), assets };
    });
}

function cancelableNativePromise<T>(
    transport: NativeTransport,
    callId: string,
    build: (id: string) => NativeBridgeMessage,
    signal?: AbortSignal,
): Promise<T> {
    signal?.throwIfAborted();
    const store = ensureNativeCallbackStore();
    const id = createRequestId();
    const pending = nativePromise<T>(transport, build, id);
    const cancel = () => {
        try {
            transport({
                id: createRequestId(),
                type: "cancelTool",
                payload: { callId },
            });
        } catch {
            // The view may have disconnected.
        }
        store[id]?.reject?.(signal?.reason ?? new Error("Tool cancelled"));
    };
    signal?.addEventListener("abort", cancel, { once: true });
    if (signal?.aborted) cancel();
    return pending.finally(() => signal?.removeEventListener("abort", cancel));
}

/** 由 transport 构造标准 `HostBridge`。 */
function createNativeBridge(transport: NativeTransport): HostBridge {
    const host: HostBridge = {
        zen: (operation, params, signal) => {
            const callId = createRequestId();
            return cancelableNativePromise(
                transport,
                callId,
                (id) => ({
                    id,
                    type: "zen",
                    payload: { operation, params, callId },
                }),
                signal,
            );
        },
        closeZen: () =>
            transport({
                id: createRequestId(),
                type: "zen",
                payload: { operation: "close", callId: createRequestId() },
            }),
        getInit: async () => {
            const init = await nativePromise<AIChatInitPayload>(
                transport,
                (id) => ({
                    id,
                    type: "getInit",
                }),
            );
            if (init.bridgeVersion !== AGENT_BRIDGE_VERSION)
                throw new Error("Incompatible native agent bridge");
            if (init.extraPromptSupport) {
                host.getExtraPrompt = () =>
                    nativePromise<string>(transport, (id) => ({
                        id,
                        type: "getExtraPrompt",
                    }));
            }
            if (init.changeSupport) {
                host.changeControl = (decision, signal) => {
                    const callId = createRequestId();
                    return cancelableNativePromise<ChangeReceipt>(
                        transport,
                        callId,
                        (id) => ({
                            id,
                            type: "changeControl",
                            payload: { ...decision, callId },
                        }),
                        signal,
                    );
                };
            }
            if (init.referenceSupport) {
                host.resolveReferences = async (references, signal) =>
                    (await host.callTool({
                        callId: createRequestId(),
                        name: "__resolveReferences",
                        params: { references },
                        history: [],
                        signal,
                    })) as unknown[];
                host.saveReferenceDraft = (draft) => {
                    transport({
                        id: createRequestId(),
                        type: "saveReferenceDraft",
                        payload: draft,
                    });
                };
                host.subscribeReferenceDeliveries = (receive) => {
                    const deliver = (delivery: ReferenceDelivery) =>
                        receive(delivery, () => {
                            transport({
                                id: createRequestId(),
                                type: "referencesConsumed",
                                payload: { deliveryId: delivery.id },
                            });
                        });
                    window.__AIChatDeliverReferences = deliver;
                    transport({
                        id: createRequestId(),
                        type: "referencesReady",
                    });
                    return () => {
                        if (window.__AIChatDeliverReferences === deliver)
                            delete window.__AIChatDeliverReferences;
                    };
                };
            }
            return init;
        },

        requestAI: async ({
            requestId,
            configId,
            purpose,
            maxTokens,
            history,
            tools,
            onChunk,
            onDone,
            onError,
        }) => {
            const wireHistory = await encodeNativeHistory(
                purpose === "summary" ? history : withToolImages(history),
            );
            const store = ensureNativeCallbackStore();
            const id = createRequestId();
            const cleanup = () => {
                delete store[id];
            };

            store[id] = {
                onChunk: (chunk) => onChunk(chunk as ProviderRequestChunk),
                onDone: () => {
                    cleanup();
                    onDone();
                },
                onError: (error) => {
                    cleanup();
                    onError(nativeError(error));
                },
            };

            try {
                transport({
                    id,
                    type: "requestAI",
                    payload: {
                        requestId,
                        configId,
                        history: wireHistory,
                        tools,
                        purpose,
                        maxTokens,
                    },
                });
            } catch (error) {
                cleanup();
                onError(nativeError(error));
            }

            const handle: HostRequestHandle = {
                cancel: () => {
                    if (!store[id]) return;
                    cleanup();
                    try {
                        transport({
                            id: createRequestId(),
                            type: "cancelRequest",
                            payload: { requestId },
                        });
                    } catch {
                        // 取消请求本身失败时静默处理：本地 callback 已清理。
                    }
                },
            };
            return handle;
        },

        callTool: ({ callId, name, params, surface, batchId, signal }) => {
            signal?.throwIfAborted();
            return cancelableNativePromise<unknown>(
                transport,
                callId,
                (id) => ({
                    id,
                    type: "callTool",
                    payload: {
                        callId,
                        name,
                        params,
                        surface,
                        batchId,
                        history: [],
                    },
                }),
                signal,
            );
        },
        endBatch: (batchId) => {
            transport({
                id: createRequestId(),
                type: "endBatch",
                payload: { batchId },
            });
        },
    };
    return host;
}

/** Android WebView：`window.CentAiChatNative.postMessage(JSON.stringify(message))`。 */
export function getAndroidNativeHost(): HostBridge | undefined {
    const native = window.CentAiChatNative;
    if (!native) return undefined;
    return createNativeBridge((message) => {
        native.postMessage(JSON.stringify(message));
    });
}

/** iOS WKWebView：`window.webkit.messageHandlers.CentAiChatNative.postMessage(message)`。 */
export function getIosNativeHost(): HostBridge | undefined {
    const native = window.webkit?.messageHandlers?.CentAiChatNative;
    if (!native) return undefined;
    return createNativeBridge((message) => {
        native.postMessage(message);
    });
}
