import type { AIConfig } from "@/ledger/extra-type";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { decodeApiKey } from "@/utils/api-key";

/**
 * 从 store 获取 AI 配置
 * @returns AI配置对象
 * @throws 如果没有配置或没有默认配置时抛出错误
 */
function getAIConfig(): AIConfig {
    const userId = useUserStore.getState().id;
    const assistantData =
        useLedgerStore.getState().infos?.meta.personal?.[userId]?.assistant;

    // 优先使用新的配置系统
    if (assistantData?.configs && assistantData.configs.length > 0) {
        const defaultConfigId = assistantData.defaultConfigId;
        if (defaultConfigId) {
            const config = assistantData.configs.find(
                (c) => c.id === defaultConfigId,
            );
            if (config) {
                return config;
            }
        }
    }

    // Fallback: 如果新配置不存在，尝试使用旧的 bigmodel 配置
    const oldApiKey = assistantData?.bigmodel?.apiKey;
    if (oldApiKey) {
        // 构造一个临时的配置对象，使用智谱 AI 的默认配置
        return {
            id: "legacy-bigmodel",
            name: "智谱GLM (Legacy)",
            apiKey: oldApiKey,
            apiUrl: "https://open.bigmodel.cn/api/paas/v4",
            model: "glm-4-flash",
            apiType: "open-ai-compatible",
        };
    }

    // 如果新旧配置都不存在，抛出错误
    throw new Error(t("ai-config-required-error"));
}

/**
 * AI API 请求，支持 OpenAI 兼容的 API 格式
 * @param messages 结构化的消息列表，包含 system、user、assistant 角色的消息
 */
export const requestAI = async (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string> => {
    // 从 store 获取 AI 配置
    const config = getAIConfig();

    // 解码 base64 编码的 API Key
    const apiKey = decodeApiKey(config.apiKey);

    // 构建 API URL
    const apiUrl = config.apiUrl.endsWith("/")
        ? `${config.apiUrl}chat/completions`
        : `${config.apiUrl}/chat/completions`;

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: config.model,
                messages,
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
            );
        }

        const data = await response.json();

        // 提取 AI 响应文本
        if (data.choices && data.choices.length > 0) {
            const content = data.choices[0].message?.content;
            if (typeof content === "string") {
                return content;
            }
        }

        throw new Error("AI API 响应格式异常");
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`AI API 请求异常: ${String(error)}`);
    }
};
