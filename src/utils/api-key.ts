/**
 * API Key 的 base64 编码/解码工具函数
 * 用于安全存储 API Key
 */

/**
 * 将 API Key 编码为 base64 字符串
 * @param apiKey 原始 API Key
 * @returns base64 编码后的字符串
 */
export function encodeApiKey(apiKey: string): string {
    if (!apiKey) {
        return "";
    }
    try {
        return btoa(unescape(encodeURIComponent(apiKey)));
    } catch (error) {
        console.error("Failed to encode API Key:", error);
        return apiKey;
    }
}

/**
 * 将 base64 编码的字符串解码为原始 API Key
 * @param encodedApiKey base64 编码的字符串
 * @returns 解码后的原始 API Key
 */
export function decodeApiKey(encodedApiKey: string): string {
    if (!encodedApiKey) {
        return "";
    }
    try {
        // 尝试解码，如果失败则返回原值（兼容未编码的旧数据）
        return decodeURIComponent(escape(atob(encodedApiKey)));
    } catch {
        // 如果解码失败，可能是未编码的旧数据，直接返回
        return encodedApiKey;
    }
}
