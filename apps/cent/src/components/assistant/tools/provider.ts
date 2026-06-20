import type { Provider } from "@glink25/chaty";
import { createAIProvider } from "@glink25/chaty/providers";
import { decodeApiKey } from "@/utils/api-key";
import { getAIConfig } from "../request";

/**
 * 把用户上传的附件渲染进 user 消息。cent 约定通过 PlaygroundTool 的 getFile 访问，
 * 故文案是 cent 专有的，作为 hook 注入给通用 provider。
 */
function formatUserAssets(assets: File[], startIndex: number): string {
    const fileList = assets
        .map((file, idx) => `(${startIndex + idx})[${file.name}]`)
        .join(", ");

    return `本次用户上传了如下文件：${fileList}。
你可以通过使用工具 PlaygroundTool，编写代码进行访问，例如使用 getFile(${startIndex}) 获取序号为 ${startIndex} 的文件。`;
}

/**
 * cent 侧对通用 provider 的二次浅包装：仅提供「取 AIConfig + 解密 apiKey」，
 * 协议分发 / 消息归一化 / 流式抽取全部由 chaty/providers 负责。
 */
export function createCentAIProvider(
    getConfigId?: () => string | undefined,
): Provider {
    return createAIProvider(
        () => {
            const config = getAIConfig(getConfigId?.());
            return { ...config, apiKey: decodeApiKey(config.apiKey) };
        },
        { formatUserAssets },
    );
}

export const CentAIProvider: Provider = createCentAIProvider();
