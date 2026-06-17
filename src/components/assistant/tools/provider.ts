import { decodeApiKey } from "@/utils/api-key";
import type { History, Provider, ToolMessage } from "../../../assistant";
import { withAbort } from "../../../assistant/shared";
import type { ChatMessage } from "../adapters/types";
import { createStreamingRequest, getAIConfig, parseStream } from "../request";

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

function truncateLongText(text: string, maxLength = 10000): string {
    if (text.length <= maxLength) return text;
    const head = text.slice(0, maxLength / 2);
    const tail = text.slice(-maxLength / 2);
    console.warn(`Text truncated: ${text.length} -> ${maxLength}`);
    return `${head}...（返回值过长，已截断）...${tail}`;
}

function formatValue(value: unknown): string {
    return truncateLongText(JSON.stringify(value));
}

function toolMessageToContent(toolMsg: ToolMessage): string {
    let content = `[工具调用: ${toolMsg.formatted.name}]\n`;
    content += `参数: ${JSON.stringify(toolMsg.formatted.params, null, 2)}\n`;

    if (toolMsg.formatted.returns !== undefined) {
        content += `返回结果: ${formatValue(toolMsg.formatted.returns)}`;
    }
    if (toolMsg.formatted.errors !== undefined) {
        content += `错误: ${formatValue(toolMsg.formatted.errors)}`;
    }

    return content;
}

function historyToMessages(history: History): ChatMessage[] {
    const messages: ChatMessage[] = [];

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
                content: `${assetPrompt ? `${assetPrompt}\n` : ""}${userContent}`,
            });
        } else if (msg.role === "assistant") {
            const tools = msg.formatted.tools;
            messages.push({
                role: "assistant",
                content: msg.formatted.answer ?? "",
                ...(tools && tools.length > 0 ? { toolCalls: tools } : {}),
            });
        } else if (msg.role === "tool") {
            // 工具结果作为带 tool_call_id 的原生 tool 消息回传，由 adapter 翻译。
            messages.push({
                role: "tool",
                toolCallId: msg.formatted.id ?? "",
                name: msg.formatted.name,
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
    request({ history, tools }) {
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
                tools,
                abortController.signal,
            );

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
                );
            }

            return parseStream(config, response);
        })();

        return withAbort(promise, () => {
            aborted = true;
            abortController?.abort();
        });
    },
};
