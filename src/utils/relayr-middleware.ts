import type { Handler } from "./fetch-proxy";

/**
 * relayr协议解析工具类
 * 预期格式: proxy://<BASE64_JSON_CONFIG>@<SUFFIX>
 */
const PROXY_PROTOCOL_PREFIX = "proxy://";

export const relayrMiddleware: Handler = async (url, options, next) => {
    const urlStr = url.toString();

    // 1. 识别是否命中代理协议
    if (!urlStr.startsWith(PROXY_PROTOCOL_PREFIX)) {
        return next(url, options);
    }

    try {
        // 2. 解析协议内容
        // 提取格式: proxy://{config_base64}@{target_path}
        const mainPart = urlStr.slice(PROXY_PROTOCOL_PREFIX.length);
        const splitIndex = mainPart.indexOf("@");

        if (splitIndex === -1)
            throw new Error("Invalid proxy format. Missing '@'");

        const configBase64 = mainPart.slice(0, splitIndex);
        const targetPathSuffix = mainPart.slice(splitIndex + 1);

        // 解码配置 (支持 UTF-8)
        const configJson = JSON.parse(atob(configBase64));
        const { proxyUrl, targetBase, headers: extraHeaders } = configJson;

        // 3. 构建最终的目标 URL (target_base + suffix)
        const finalTargetUrl = `${targetBase}${targetPathSuffix}`;
        // 4. 转换请求参数
        const newOptions: RequestInit = {
            ...options,
            method: "POST",
            headers: {
                ...options.headers,
                ...extraHeaders,
                "x-relayr-target": finalTargetUrl,
                "x-relayr-method": options.method,
                "Content-Type": "application/json",
            },
            // 根据你的要求，将原 body 和 target 封装进新的 body
            body: options.body,
        };

        console.log(
            `[Proxy Forwarding][${options.method}] ${finalTargetUrl} -> ${proxyUrl}`,
        );
        return next(proxyUrl, newOptions);
    } catch (err) {
        console.error("[Proxy Middleware Error]", err);
        return next(url, options); // 解析失败则降级原样发送
    }
};
// function buildProxyUrl(proxyUrl, targetBase, headers) {
//     const config = {
//         proxyUrl,
//         targetBase,
//         headers
//     };
//     // 使用 btoa 将配置转为 base64
//     const configBase64 = btoa(unescape(encodeURIComponent(JSON.stringify(config))));
//     return `proxy://${configBase64}@`;
// }

// // --- 实际调用 ---
// const proxyPrefix = buildProxyUrl(
//     'https://kesakirsqxornlnqqxra.supabase.co/functions/v1/proxy',
//     'https://generativelanguage.googleapis.com',{'x-relayr-token':''}
// );
// console.log(proxyPrefix)
