import type { ProviderRequestChunk } from "../assistant";
import type {
    AIChatInitPayload,
    HostBridge,
    HostRequestHandle,
    NativeBridgeMessage,
    NativeCallback,
} from "./types";

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

function createRequestId(): string {
    return (
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    );
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
): Promise<T> {
    const store = ensureNativeCallbackStore();
    const id = createRequestId();
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

/** 由 transport 构造标准 `HostBridge`。 */
function createNativeBridge(transport: NativeTransport): HostBridge {
    return {
        getInit: () =>
            nativePromise<AIChatInitPayload>(transport, (id) => ({
                id,
                type: "getInit",
            })),

        requestAI: ({
            requestId,
            configId,
            history,
            tools,
            onChunk,
            onDone,
            onError,
        }) => {
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
                    payload: { requestId, configId, history, tools },
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

        callTool: ({ callId, name, params, history }) =>
            nativePromise<unknown>(transport, (id) => ({
                id,
                type: "callTool",
                payload: { callId, name, params, history },
            })),
    };
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
