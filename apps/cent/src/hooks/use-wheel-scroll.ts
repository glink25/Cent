import { type RefObject, useEffect } from "react";

/**
 * useWheelScrollX - 将垂直滚动转化为横向滚动的 Hook
 * @param ref 容器的 Ref
 * @param speed 滚动速度缩放系数 (默认为 1)
 */
export const useWheelScrollX = (
    ref: RefObject<HTMLElement | null>,
    speed: number = 1,
) => {
    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const handleWheel = (e: WheelEvent) => {
            // 核心逻辑：
            // 1. 如果 deltaX 不为 0，说明用户已经在进行原生横向滚动（如触控板、侧滚轮）
            // 2. 此时我们不应该干预，否则会造成双向滚动冲突
            if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
                return;
            }

            // 如果主要是垂直滚动 (deltaY)，则手动修改 scrollLeft
            if (e.deltaY !== 0) {
                // 执行横向位移
                el.scrollLeft += e.deltaY * speed;
            }
        };
        el.addEventListener("wheel", handleWheel, { passive: true });

        return () => {
            el.removeEventListener("wheel", handleWheel);
        };
    }, [ref, speed]);
};
