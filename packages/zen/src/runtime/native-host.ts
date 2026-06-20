import type {
    NativeBridgeMessage,
    NativeCallback,
    ZenRuntimeHost,
} from "./types";

type Sender = (message: NativeBridgeMessage) => void;
const id = () =>
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;

function callbacks() {
    if (!window.__ZenNativeCallbacks) window.__ZenNativeCallbacks = {};
    return window.__ZenNativeCallbacks;
}

function request<T>(
    send: Sender,
    type: NativeBridgeMessage["type"],
    payload?: unknown,
): Promise<T> {
    const messageId = id();
    return new Promise<T>((resolve, reject) => {
        callbacks()[messageId] = {
            resolve: (value) => {
                delete callbacks()[messageId];
                resolve(value as T);
            },
            reject: (error) => {
                delete callbacks()[messageId];
                reject(normalizeError(error));
            },
        };
        send({
            id: messageId,
            type,
            ...(payload === undefined ? {} : { payload }),
        } as NativeBridgeMessage);
    });
}

function normalizeError(error: unknown) {
    if (error instanceof Error) return error;
    if (error && typeof error === "object" && "message" in error)
        return new Error(String(error.message));
    return new Error(String(error));
}

function createNativeHost(send: Sender): ZenRuntimeHost {
    return {
        getInit: () => request(send, "getInit"),
        getZenContext: (payload) => request(send, "getZenContext", payload),
        listZenPosts: (payload = {}) => request(send, "listZenPosts", payload),
        saveZenPost: (payload) => request(send, "saveZenPost", payload),
        callAITool: (payload) => request(send, "callAITool", payload),
        requestAI: (payload) => {
            const messageId = id();
            const callback: NativeCallback = {
                onChunk: payload.onChunk,
                onDone: () => {
                    delete callbacks()[messageId];
                    payload.onDone();
                },
                onError: (error) => {
                    delete callbacks()[messageId];
                    payload.onError(normalizeError(error));
                },
            };
            callbacks()[messageId] = callback;
            send({
                id: messageId,
                type: "requestAI",
                payload: {
                    requestId: payload.requestId,
                    configId: payload.configId,
                    history: payload.history,
                    tools: payload.tools,
                },
            });
            return {
                cancel: () => {
                    delete callbacks()[messageId];
                    send({
                        id: id(),
                        type: "cancelAIRequest",
                        payload: { requestId: payload.requestId },
                    });
                },
            };
        },
    };
}

export function getAndroidNativeHost() {
    const bridge = window.CentZenNative;
    return bridge
        ? createNativeHost((message) =>
              bridge.postMessage(JSON.stringify(message)),
          )
        : undefined;
}

export function getIosNativeHost() {
    const bridge = window.webkit?.messageHandlers?.CentZenNative;
    return bridge
        ? createNativeHost((message) => bridge.postMessage(message))
        : undefined;
}
