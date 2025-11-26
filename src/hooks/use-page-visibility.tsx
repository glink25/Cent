import { useEffect, useRef } from "react";

/**
 * 监听页面可见性变化的 Hook
 */
export const usePageVisibility = (
    callback?: () => void,
    options?: { disabled?: boolean },
) => {
    const callbackRef = useRef(callback);

    useEffect(() => {
        // 如果是 SSR 环境，直接返回
        if (typeof document === "undefined" || options?.disabled) return;

        const handleVisibilityChange = () => {
            callbackRef.current?.();
        };

        // 监听 visibilitychange 事件
        document.addEventListener("visibilitychange", handleVisibilityChange);
        handleVisibilityChange();
        // 清理副作用
        return () => {
            document.removeEventListener(
                "visibilitychange",
                handleVisibilityChange,
            );
        };
    }, [options?.disabled]);
};
