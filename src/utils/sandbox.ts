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
        ${inject}
        self.onmessage = async function(e) {
            if (e.data.type === 'init') {
                globalThis.__FROM_TRANSFER__ = e.data.transferable;
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
                    self.postMessage({ success: true, result });
                } finally {
                    URL.revokeObjectURL(url);
                }
            } catch (error) {
                self.postMessage({ success: false, error: error.message });
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

                // 超时逻辑保持不变...
                const timeoutId = setTimeout(() => {
                    reject(
                        new Error(
                            `Timeout: code running time exceeded ${timeout}ms`,
                        ),
                    );
                    w.terminate();
                    worker = null;
                }, timeout);

                w.onmessage = (e) => {
                    clearTimeout(timeoutId);
                    if (e.data.success) resolve(e.data.result);
                    else reject(new Error(e.data.error));
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
