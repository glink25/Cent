import { decodeApiKey } from "@/utils/api-key";
import type { AbortablePromise, History, Provider, ToolMessage } from "../core";
import { withAbort } from "../core/shared";
import {
    createStreamingRequest,
    getAIConfig,
    parseGoogleStream,
    parseOpenAIStream,
} from "../request";

function countHistoryAssets(history: History): number {
    return history.reduce((count, msg) => {
        if (msg.role === "user" && msg.assets) {
            return count + msg.assets.length;
        }
        return count;
    }, 0);
}

function assetsToPrompt(
    assets: File[] | undefined,
    startIndex: number,
): string {
    if (!assets?.length) return "";

    const fileList = assets
        .map((file, idx) => `(${startIndex + idx})[${file.name}]`)
        .join(", ");

    return `本次用户上传了如下文件：${fileList}。
你可以通过使用工具 PlaygroundTool，编写代码进行访问，例如使用 getFile(${startIndex}) 获取序号为 ${startIndex} 的文件。`;
}

function toolMessageToContent(toolMsg: ToolMessage): string {
    let content = `[工具调用: ${toolMsg.formatted.name}]\n`;
    content += `参数: ${JSON.stringify(toolMsg.formatted.params, null, 2)}\n`;

    if (toolMsg.formatted.returns !== undefined) {
        content += `返回结果: ${JSON.stringify(toolMsg.formatted.returns, null, 2)}`;
    }
    if (toolMsg.formatted.errors !== undefined) {
        content += `错误: ${JSON.stringify(toolMsg.formatted.errors, null, 2)}`;
    }

    return content;
}

function historyToMessages(
    history: History,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
    const messages: Array<{
        role: "system" | "user" | "assistant";
        content: string;
    }> = [];

    const assetIndex = 1;
    for (const msg of history) {
        if (msg.role === "user") {
            const userContent = msg.raw;
            const assetPrompt =
                msg.assets && msg.assets.length > 0
                    ? assetsToPrompt(msg.assets, assetIndex)
                    : undefined;
            messages.push({
                role: "user",
                content: `${assetPrompt}/n${userContent}`,
            });
        } else if (msg.role === "assistant") {
            messages.push({ role: "assistant", content: msg.raw });
        } else if (msg.role === "tool") {
            messages.push({
                role: "user",
                content: toolMessageToContent(msg),
            });
        } else if (msg.role === "system") {
            messages.push({
                role: "system",
                content: msg.raw,
            });
        }
    }

    return messages;
}

export const CentAIProvider: Provider = {
    request({ history }) {
        let aborted = false;
        let abortController: AbortController | null = null;

        const promise = (async () => {
            const config = getAIConfig();
            const apiKey = decodeApiKey(config.apiKey);

            const messages = historyToMessages(history);

            abortController = new AbortController();
            if (aborted) {
                abortController.abort();
            }

            const response = await createStreamingRequest(
                config,
                apiKey,
                messages,
                abortController.signal,
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
                );
            }

            if (config.apiType === "google-ai-studio") {
                return parseGoogleStream(response);
            } else {
                return parseOpenAIStream(response);
            }
        })();

        return withAbort(promise, () => {
            aborted = true;
            abortController?.abort();
        });
    },
};
