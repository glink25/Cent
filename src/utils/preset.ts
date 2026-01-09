export const CUSTOM_CSS_STORAGE_KEY = "local-custom-css";

/**
 * CSS 文本净化函数，防止 XSS 攻击
 * 只允许 data: 开头的 URL 引入
 */
export function purifyCSS(css: string): string {
    if (!css || typeof css !== "string") {
        return "";
    }

    // 移除 javascript: URL
    let purified = css.replace(/javascript:/gi, "");

    // 移除 expression() 和其他危险的函数调用
    purified = purified.replace(/expression\s*\(/gi, "");

    // 处理 url() 函数，只允许 data: 开头的 URL
    purified = purified.replace(
        /url\s*\(\s*["']?([^"')]+)["']?\s*\)/gi,
        (_match, url) => {
            const trimmedUrl = url.trim();
            // 只允许 data: 开头的 URL
            if (trimmedUrl.startsWith("data:")) {
                return `url(${trimmedUrl})`;
            }
            // 移除不安全的 URL
            return "";
        },
    );

    // 移除其他危险的协议（http, https, // 等）
    purified = purified.replace(
        /(https?:|ftp:|file:|about:|mailto:|tel:|\/\/)/gi,
        "",
    );

    return purified;
}

/**
 * 无依赖的 applyCustomCSS 函数
 * 读取持久化的 localStorage 中的 customCSS 值，进行简易的 css 文本 purify 处理
 * 然后应用到 document.documentElement.style.cssText 中
 */
export function applyCustomCSS() {
    try {
        const css = localStorage.getItem(CUSTOM_CSS_STORAGE_KEY);
        if (!css) {
            // 如果没有 CSS，清除之前可能存在的样式
            document.getElementById("custom-css-injected")?.remove();
            return;
        }

        const purified = purifyCSS(css);
        // 应用到 document.documentElement.style.cssText
        // 注意：cssText 会覆盖所有现有样式，所以我们需要保留原有样式并追加
        // 或者使用 style 标签来注入 CSS
        // 这里使用 style 标签更安全，避免覆盖现有样式
        let styleElement = document.getElementById(
            "custom-css-injected",
        ) as HTMLStyleElement | null;

        if (!styleElement) {
            styleElement = document.createElement("style");
            styleElement.id = "custom-css-injected";
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = purified;
    } catch (error) {
        console.error("Failed to apply custom CSS:", error);
    }
}
