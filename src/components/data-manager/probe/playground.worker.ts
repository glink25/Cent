/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { expose } from "comlink";
import Papa from "papaparse";
import * as XLSX from "xlsx";
import { smartLog } from "./log";

interface ExecutionResult {
    logs: string[];
    result?: any;
    error?: string;
}

class PlaygroundWorker {
    private logs: string[] = [];
    private result: any = null;
    private isComplete: boolean = false;
    private completeResolver: ((value: void) => void) | null = null;
    private completePromise: Promise<void> | null = null;

    /**
     * 执行代码
     */
    async executeCode(
        code: string,
        context: {
            file?: File;
            fileContent?: string | ArrayBuffer;
            fileName?: string;
            [key: string]: any;
        },
    ): Promise<ExecutionResult> {
        // 重置状态
        this.logs = [];
        this.result = null;
        this.isComplete = false;
        this.completeResolver = null;
        this.completePromise = new Promise<void>((resolve) => {
            this.completeResolver = resolve;
        });

        try {
            // 准备全局变量
            const { file, fileContent, fileName, ...restContext } = context;
            const globalContext: any = {
                // 文件相关
                file: file || null,
                fileContent: fileContent || null,
                fileName: fileName || null,
                // 库
                Papa,
                XLSX,
                // 工具函数
                log: (...args: any[]) => {
                    const logMessage = args
                        .map((arg) => smartLog(arg))
                        .join(" ");
                    this.logs.push(logMessage);
                },
                // complete 函数：结束执行并返回结果
                complete: (result: any) => {
                    this.result = result;
                    this.isComplete = true;
                    if (this.completeResolver) {
                        this.completeResolver();
                    }
                },
                // 其他注入的上下文变量
                ...restContext,
            };

            // 创建执行环境
            const functionBody = `
                ${code}
            `;

            // 使用 Function 构造函数创建执行环境
            const executeFn = new Function(
                ...Object.keys(globalContext),
                functionBody,
            );

            // 执行代码（可能是同步或异步）
            const executionResult = executeFn(...Object.values(globalContext));

            // 如果返回 Promise，等待其完成
            if (executionResult && typeof executionResult.then === "function") {
                await executionResult;
            }

            // 创建超时 Promise（10秒）
            const timeoutPromise = new Promise<void>((resolve) => {
                setTimeout(() => {
                    resolve();
                }, 10000);
            });

            // 等待 complete 被调用或超时
            await Promise.race([this.completePromise, timeoutPromise]);

            // 如果超时且没有调用 complete，返回超时提示
            if (!this.isComplete) {
                this.logs.push(
                    "执行超时：代码在 10 秒内未调用 complete() 函数",
                );
                return {
                    logs: this.logs,
                    error: "执行超时：代码在 10 秒内未调用 complete() 函数",
                };
            }

            // 如果调用了 complete，返回结果
            return {
                logs: this.logs,
                result: this.result,
            };
        } catch (error) {
            return {
                logs: this.logs,
                error: String(error),
            };
        }
    }
}

const worker = new PlaygroundWorker();

const exposed = {
    executeCode: (
        code: string,
        context: {
            file?: File;
            fileContent?: string | ArrayBuffer;
            fileName?: string;
            [key: string]: any;
        },
    ) => worker.executeCode(code, context),
};

export type Exposed = typeof exposed;

expose(exposed);
