import { wrap } from "comlink";
import type { Exposed } from "./playground.worker";
import PlaygroundWorker from "./playground.worker?worker";

// 创建 worker 实例并包装
let workerInstance: Worker | null = null;
let PlaygroundAPI: any = null;

function getWorker() {
    if (!workerInstance) {
        workerInstance = new PlaygroundWorker();
        PlaygroundAPI = wrap<Exposed>(workerInstance);
    }
    return PlaygroundAPI;
}

/**
 * 创建 playground 环境并执行代码
 * @param code 大模型输出的可执行 JS 代码
 * @param context 预先注入的全局变量（如 File 对象、Papa、XLSX 等）
 * @returns 执行结果，包含 logs 和 result（如果调用了 complete 函数）
 */
export async function createPlayground(
    code: string,
    context: {
        file?: File;
        fileContent?: string | ArrayBuffer;
        fileName?: string;
        [key: string]: any;
    },
): Promise<{
    logs: string[];
    result?: any;
    error?: string;
}> {
    const api = getWorker();
    try {
        const result = await api.executeCode(code, context);
        return result;
    } catch (error) {
        return {
            logs: [],
            error: String(error),
        };
    }
}

/**
 * 清理 worker 资源
 */
export function cleanupPlayground() {
    if (workerInstance) {
        workerInstance.terminate();
        workerInstance = null;
        PlaygroundAPI = null;
    }
}
