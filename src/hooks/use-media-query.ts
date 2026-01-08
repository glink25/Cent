// hooks/useMediaQuery.js
import { useEffect, useState } from "react";

/**
 * 监听媒体查询，判断当前屏幕是否匹配
 */
export function useMediaQuery(query: string) {
    const [matches, setMatches] = useState(() =>
        typeof window !== "undefined"
            ? window.matchMedia(query).matches
            : false,
    );

    useEffect(() => {
        // 确保在客户端环境运行
        if (typeof window !== "undefined") {
            const media = window.matchMedia(query);

            // 初始设置
            setMatches(media.matches);

            const listener = () => setMatches(media.matches);

            // 监听变化
            media.addEventListener("change", listener);

            // 清理函数
            return () => media.removeEventListener("change", listener);
        }
    }, [query]);

    return matches;
}

// 符合tailwindcss sm 的分界线定义
export const useIsDesktop = () => useMediaQuery("(min-width: 640px)");
