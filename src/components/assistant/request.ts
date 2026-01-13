import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { decodeApiKey } from "@/utils/api-key";

/**
 * 智谱AI的api请求，参考文档：https://docs.bigmodel.cn/cn/guide/develop/http/introduction
 * @param messages 结构化的消息列表，包含 system、user、assistant 角色的消息
 */
export const requestAI = async (
    messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
): Promise<string> => {
    // 从 store 获取 API Key（base64 编码的）
    const userId = useUserStore.getState().id;
    const encodedApiKey =
        useLedgerStore.getState().infos?.meta.personal?.[userId]?.assistant
            ?.bigmodel?.apiKey;
    if (!encodedApiKey) {
        throw new Error(t("ai-key-required-error"));
    }
    // 解码 base64 编码的 API Key
    const apiKey = decodeApiKey(encodedApiKey);

    // 智谱AI API 端点
    const apiUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";

    try {
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
                model: "glm-4", // 使用 glm-4 模型
                messages,
                temperature: 0.7,
                max_tokens: 2000,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(
                `智谱AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
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

        throw new Error("智谱AI API 响应格式异常");
    } catch (error) {
        if (error instanceof Error) {
            throw error;
        }
        throw new Error(`智谱AI API 请求异常: ${String(error)}`);
    }
};
