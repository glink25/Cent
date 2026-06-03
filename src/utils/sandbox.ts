/**
 * 创建一个web worker沙盒环境，并且只允许白名单中的JS api
 * 使用proxy和new Function限制白名单
 */

export const API = {
    Date: "Date",
    Math: "Math",
    JSON: "JSON",
    Array: "Array",
    Object: "Object",
    Number: "Number",
    String: "String",
    Boolean: "Boolean",
    RegExp: "RegExp",
    Error: "Error",
    console: "console",
} as const;

export type API = keyof typeof API;

const BLOCKED_GLOBALS = [
    "eval",
    "Function",
    "XMLHttpRequest",
    "WebSocket",
    "fetch",
    "document",
    "window",
    // "globalThis",
    "Worker",
    "SharedWorker",
    "ServiceWorker",
    // "importScripts",
    // "setTimeout",
    // "setInterval",
    // "setImmediate",
    // "clearTimeout",
    // "clearInterval",
    // "clearImmediate",
    "process",
    "require",
    "module",
    "exports",
    "__dirname",
    "__filename",
    "indexedDB",
    "IDBFactory",
    "IDBDatabase",
    "IDBRequest",
];

function createWorkerCode(whiteList: API[], inject?: string): string {
    const blockedAPIs = [...BLOCKED_GLOBALS];

    return `
        (function() {
            // --- 核心加固函数 ---
            const blockAndLock = (obj, prop) => {
                try {
                    Object.defineProperty(obj, prop, {
                        get: () => { throw new Error("SecurityError: Access to " + prop + " is blocked."); },
                        configurable: false,
                        enumerable: false
                    });
                } catch (e) {
                    // 如果无法重新定义，尝试直接设为 undefined
                    try { obj[prop] = undefined; } catch(e2) {}
                }
            };

            // 1. 深度清理原型链（防止通过 prototype 找回 API）
            const targets = [self, WorkerGlobalScope.prototype, EventTarget.prototype];
            const blockList = ${JSON.stringify(blockedAPIs)};
            
            targets.forEach(target => {
                if (!target) return;
                blockList.forEach(api => {
                    if (api in target) blockAndLock(target, api);
                });
            });

            // 2. 封锁构造函数逃逸
            // 禁止通过 函数实例.constructor 创建新函数
            try {
                const noOp = () => { throw new Error("SecurityError: Dynamic execution is blocked."); };
                // 覆盖 Function 构造函数
                self.constructor.constructor = noOp;
                // 覆盖异步函数构造器
                (async function(){}).constructor.constructor = noOp;
            } catch(e) {
            console.warn("Failed to lock down Function constructor:", e); 
            }
        })();
        globalThis.__FROM_TRANSFER__ = [];

        // --- Host RPC bridge ---
        // 允许沙盒内代码通过 globalThis.__CALL_HOST__(name, params) 调用宿主侧函数（如其它工具）。
        // 宿主收到 { type: 'rpc-call', id, name, params }，处理后回传 { type: 'rpc-result', id, success, result/error }。
        const __RPC_PENDING__ = new Map();
        let __rpcId = 0;
        globalThis.__CALL_HOST__ = (name, params) => new Promise((resolve, reject) => {
            const id = ++__rpcId;
            __RPC_PENDING__.set(id, { resolve, reject });
            self.postMessage({ type: 'rpc-call', id, name, params });
        });

        ${inject}
        self.onmessage = async function(e) {
            if (e.data.type === 'init') {
                globalThis.__FROM_TRANSFER__ = e.data.transferable;
                return;
            }
            if (e.data.type === 'rpc-result') {
                const pending = __RPC_PENDING__.get(e.data.id);
                if (pending) {
                    __RPC_PENDING__.delete(e.data.id);
                    if (e.data.success) pending.resolve(e.data.result);
                    else pending.reject(new Error(e.data.error));
                }
                return;
            }
            const { code, args } = e.data;
            try {
                // 此时环境已经通过 IIFE 完成了加固，直接开始执行
                const blob = new Blob([code], { type: 'application/javascript' });
                const url = URL.createObjectURL(blob);

                try {
                    const userModule = await import(url);
                    const renderFn = userModule.default;
                    if (typeof renderFn !== 'function') throw new Error('Must export default a function');

                    const result = await renderFn(...args);
                    self.postMessage({ type: 'result', success: true, result });
                } finally {
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                self.postMessage({ type: 'result', success: false, error: error.message });
            }
        };
    `;
}

/**
 * @description 使用web worker+proxy、with等创建一个简单沙盒运行环境，并且注入一些自定义js代码
 */
export default function createSandBox(
    whiteList: API[],
    inject?: string,
    transferable?: Array<{ index: number; file: File }>,
    onHostCall?: (name: string, params: unknown) => Promise<unknown>,
) {
    let worker: Worker | null = null;
    const workerCode = createWorkerCode(whiteList, inject);
    const blob = new Blob([workerCode], { type: "application/javascript" });
    const workerUrl = URL.createObjectURL(blob);

    const initWorker = () => {
        if (!worker) {
            // 关键：必须指定 type 为 'module'
            worker = new Worker(workerUrl, { type: "module" });
            // Transmit transferable data immediately after creation
            if (transferable) {
                worker.postMessage({ type: "init", transferable });
            }
        }
        return worker;
    };

    return {
        /**
         * @description 运行一段代码，该代码必须有一个默认导出函数，其中参数args将会作为默认导出函数运行的参数
         */
        runDefaultExport: async (
            code: string,
            args: unknown[],
            timeout = 5000,
        ): Promise<unknown> => {
            return new Promise((resolve, reject) => {
                const w = initWorker();

                // 超时只统计沙盒自身的计算时间：当存在正在进行的宿主 RPC 调用
                // （例如 importBills 弹出的预览对话框在等待用户确认）时暂停计时，
                // 全部完成后再重新计时，避免误判超时。
                let timeoutId: ReturnType<typeof setTimeout> | null = null;
                let inflightRpc = 0;
                const disarm = () => {
                    if (timeoutId !== null) {
                        clearTimeout(timeoutId);
                        timeoutId = null;
                    }
                };
                const arm = () => {
                    disarm();
                    timeoutId = setTimeout(() => {
                        reject(
                            new Error(
                                `Timeout: code running time exceeded ${timeout}ms`,
                            ),
                        );
                        w.terminate();
                        worker = null;
                    }, timeout);
                };
                arm();

                w.onmessage = async (e) => {
                    const data = e.data;
                    if (data?.type === "rpc-call") {
                        inflightRpc++;
                        disarm();
                        try {
                            if (!onHostCall) {
                                throw new Error(
                                    "Host calls are not supported in this sandbox.",
                                );
                            }
                            const result = await onHostCall(
                                data.name,
                                data.params,
                            );
                            w.postMessage({
                                type: "rpc-result",
                                id: data.id,
                                success: true,
                                result,
                            });
                        } catch (error) {
                            w.postMessage({
                                type: "rpc-result",
                                id: data.id,
                                success: false,
                                error:
                                    error instanceof Error
                                        ? error.message
                                        : String(error),
                            });
                        } finally {
                            inflightRpc--;
                            if (inflightRpc === 0) arm();
                        }
                        return;
                    }

                    // 最终结果
                    disarm();
                    if (data.success) resolve(data.result);
                    else reject(new Error(data.error));
                };

                w.postMessage({ type: "run", code, args });
            });
        },

        destroy: () => {
            if (worker) {
                worker.terminate();
                worker = null;
            }
            URL.revokeObjectURL(workerUrl);
        },
    };
}
