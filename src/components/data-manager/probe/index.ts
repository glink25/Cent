import { TypeText } from "../type-code";
import { cleanupPlayground, createPlayground } from "./playground";
import { STRUCTURE_ANALYZE_SYSTEM_PROMPT as OMTP_SYSTEM_PROMPT } from "./prompts";

// 全局DEBUG变量，控制是否开启debug打印
const DEBUG = import.meta.env.DEV === true;

// 统一的debug打印方法
function debugLog(tag: string, data: any) {
    if (DEBUG) {
        console.log(`[Playground Debug] ${tag}:`, data);
    }
}

// 读取文件内容（不进行解析）
async function readFileContent(file: File): Promise<{
    content: string | ArrayBuffer;
    fileName: string;
}> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result;
                if (!content) {
                    reject(new Error("Failed to read file"));
                    return;
                }
                resolve({
                    content: content as string | ArrayBuffer,
                    fileName: file.name,
                });
            } catch (error) {
                reject(error);
            }
        };
        reader.onerror = () => {
            reject(new Error("Failed to read file"));
        };
        // CSV 和 JSON 文件作为文本读取，Excel 文件作为 ArrayBuffer 读取
        if (file.name.endsWith(".csv") || file.name.endsWith(".json")) {
            reader.readAsText(file);
        } else {
            reader.readAsArrayBuffer(file);
        }
    });
}

/**
 * 检测 AI 响应中是否包含 Ready 标签
 */
function hasReadyTag(text: string): boolean {
    return /<Ready><\/Ready>/i.test(text);
}

/**
 * 从 AI 响应中提取代码
 * @returns { code: string, isFinal: boolean } 返回代码和是否为最终代码的标志
 */
function extractCode(text: string): { code: string; isFinal: boolean } | null {
    // 优先提取 <Answer> 标签中的内容（最终代码）
    const answerMatch = text.match(/<Answer>([\s\S]*?)<\/Answer>/);
    if (answerMatch) {
        return {
            code: answerMatch[1].trim(),
            isFinal: true,
        };
    }
    // 提取 <Code> 标签中的内容（探索阶段代码）
    const codeMatch = text.match(/<Code>([\s\S]*?)<\/Code>/);
    if (codeMatch) {
        return {
            code: codeMatch[1].trim(),
            isFinal: false,
        };
    }
    // 如果都没有，尝试提取代码块（默认为探索阶段）
    const codeBlockMatch = text.match(/```(?:javascript|js)?\n?([\s\S]*?)```/);
    if (codeBlockMatch) {
        return {
            code: codeBlockMatch[1].trim(),
            isFinal: false,
        };
    }
    return null;
}

export async function startTransform(
    file: File,
    requestAI: (messages: any[]) => Promise<string>,
) {
    // 读取文件内容
    const { content, fileName } = await readFileContent(file);

    const fileType = fileName.endsWith(".csv")
        ? "CSV"
        : fileName.endsWith(".xlsx") || fileName.endsWith(".xls")
          ? "XLSX"
          : fileName.endsWith(".json")
            ? "JSON"
            : "未知";

    const messages: any[] = [
        { role: "system", content: OMTP_SYSTEM_PROMPT },
        {
            role: "user",
            content: `文件已上传。文件名：${fileName}，文件类型：${fileType}。请开始分析和转换这个文件。`,
        },
    ];

    let isFinished = false;
    let finalResult = null;
    let maxIterations = 200; // 防止死循环
    let executionCount = 0; // 代码执行次数
    let hasReceivedStructure = false; // 是否已经发送过结构定义

    try {
        while (!isFinished && maxIterations > 0) {
            const aiResponse = await requestAI(messages);
            debugLog("AI Response", aiResponse);
            messages.push({ role: "assistant", content: aiResponse });

            // 检测 Ready 标签
            if (hasReadyTag(aiResponse) && !hasReceivedStructure) {
                hasReceivedStructure = true;
                // 发送标准交易结构定义
                messages.push({
                    role: "user",
                    content: `很好！你已经理解了文件结构并找到了账单数组的位置。现在为你提供标准交易结构定义：

\`\`\`typescript
/**
 * 我的记账App标准交易结构
 */
${TypeText}
\`\`\`

请根据这个结构定义，开始编写转换代码，将原始数据转换为符合上述结构的格式。`,
                });
                maxIterations--;
                continue;
            }

            // 提取代码
            const codeInfo = extractCode(aiResponse);
            if (!codeInfo) {
                // 如果没有代码，可能是思考阶段，继续对话
                messages.push({
                    role: "user",
                    content: `请提供可执行的 JavaScript 代码。在探索阶段，将代码放在 <Code> 标签中；完成探索后，将最终代码放在 <Answer> 标签中。`,
                });
                maxIterations--;
                continue;
            }

            const { code, isFinal } = codeInfo;
            debugLog("Extracted Code", { code, isFinal });

            // 在 playground 中执行代码
            executionCount++;
            const executionResult = await createPlayground(code, {
                file,
                fileContent: content,
                fileName,
            });

            debugLog("Execution Result", {
                logs: executionResult.logs,
                hasResult: !!executionResult.result,
                error: executionResult.error,
                isFinal,
            });

            // 构建反馈消息
            let feedbackMessage = "";

            if (executionResult.error) {
                // 执行出错
                feedbackMessage = `<Observation>
代码执行失败（第 ${executionCount} 次执行）。错误信息：
${executionResult.error}

${executionResult.logs.length > 0 ? `执行日志：\n${executionResult.logs.join("\n")}\n` : ""}

请根据错误信息分析问题并重新编写代码。常见问题包括：
1. 语法错误（如缺少括号、引号、分号等）
2. 变量未定义或作用域问题
3. 文件解析参数不正确
4. 数据路径或格式理解错误

请重新分析问题，修正代码，并在 <Code> 标签中输出新的代码。
</Observation>`;
            } else if (isFinal && executionResult.result !== undefined) {
                // 最终阶段且调用了 complete，返回了结果
                finalResult = executionResult.result;
                isFinished = true;
                debugLog(
                    "Success",
                    `代码执行成功，已获得最终结果（经过 ${executionCount} 次执行）`,
                );
                break;
            } else if (isFinal && executionResult.result === undefined) {
                // 最终阶段但没有调用 complete
                feedbackMessage = `<Observation>
你已返回 <Answer> 标签中的最终代码，但代码执行后未调用 complete(result) 函数返回结果。

执行日志：
${executionResult.logs.length > 0 ? executionResult.logs.join("\n") : "（无日志输出）"}

请在 <Answer> 标签的代码中调用 complete(result) 函数返回最终转换结果。
</Observation>`;
            } else if (!isFinal && executionResult.result !== undefined) {
                // 探索阶段调用了 complete，这只是终止执行，不是最终结果
                feedbackMessage = `<Observation>
代码已执行（第 ${executionCount} 次执行），你调用了 complete() 函数终止了代码执行。

执行日志：
${executionResult.logs.length > 0 ? executionResult.logs.join("\n") : "（无日志输出）"}

请根据日志信息分析当前状态，继续编写代码完成转换任务。当转换逻辑完成并验证无误后，请将最终代码放在 <Answer> 标签中，并在代码中调用 complete(result) 函数返回最终结果。
</Observation>`;
            } else {
                // 探索阶段代码执行了但没有调用 complete，返回日志
                feedbackMessage = `<Observation>
代码已执行（第 ${executionCount} 次执行）。

执行日志：
${executionResult.logs.length > 0 ? executionResult.logs.join("\n") : "（无日志输出）"}

请根据日志信息分析当前状态，继续编写代码完成转换任务。当转换逻辑完成并验证无误后，请将最终代码放在 <Answer> 标签中，并在代码中调用 complete(result) 函数返回最终结果。
</Observation>`;
            }

            if (feedbackMessage) {
                messages.push({
                    role: "user",
                    content: feedbackMessage,
                });
            }

            maxIterations--;
        }

        if (!isFinished && maxIterations === 0) {
            // 达到最大迭代次数
            finalResult = {
                error: "达到最大迭代次数，未能完成转换",
                detail: `已执行 ${executionCount} 次代码，但未能获得最终结果`,
            };
            console.error(`[Playground] 达到最大迭代次数 (${maxIterations})`);
        }
    } finally {
        // 清理资源
        cleanupPlayground();
    }

    return finalResult;
}
