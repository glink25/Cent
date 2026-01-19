import { type HtmlHTMLAttributes, useCallback, useRef } from "react";

export type UseLongPressOptions = {
    disabled?: boolean;
    // 仅在长按手势触发前松手时触发
    onClick?: () => void;
    // 长按手势触发（达到 threshold 时间）
    onLongPressStart?: () => void;
    // 长按手势取消（移动手指或被系统打断导致未达成时长）
    onLongPressCancel?: () => void;
    // 长按手势结束（触发长按后松手结束）
    onLongPressEnd?: () => void;
};

// 辅助函数：从事件中提取坐标
const getCoords = (event: any) => {
    if ("touches" in event && event.touches.length > 0) {
        return { x: event.touches[0].clientX, y: event.touches[0].clientY };
    } else if ("changedTouches" in event && event.changedTouches.length > 0) {
        return {
            x: event.changedTouches[0].clientX,
            y: event.changedTouches[0].clientY,
        };
    } else {
        return { x: event.clientX, y: event.clientY };
    }
};

export function useLongPress(options: UseLongPressOptions) {
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const isDown = useRef(false);

    const isLongPress = useRef<{ x: number; y: number } | undefined>(undefined);
    const longPressTimeout = useRef<NodeJS.Timeout | undefined>(undefined);

    const onPointerDown = useCallback((e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;
        isDown.current = true;
        el?.setPointerCapture(e.pointerId);
        longPressTimeout.current = setTimeout(() => {
            isLongPress.current = getCoords(e);
            optionsRef.current.onLongPressStart?.();
        }, 400);
    }, []);

    const onPointerUp = useCallback((e: PointerEvent) => {
        const el = e.currentTarget as HTMLElement;

        e.preventDefault();
        e.stopPropagation();
        el.releasePointerCapture(e.pointerId);

        if (longPressTimeout.current) {
            clearTimeout(longPressTimeout.current);
            longPressTimeout.current = undefined;
        }
        if (isLongPress.current) {
            const current = getCoords(e);
            const distance = Math.sqrt(
                (current.x - isLongPress.current.x) ** 2 +
                    (current.y - isLongPress.current.y) ** 2,
            );
            if (distance < 20) {
                optionsRef.current.onLongPressEnd?.();
            } else {
                optionsRef.current.onLongPressCancel?.();
            }
        } else {
            optionsRef.current.onClick?.();
        }
        isLongPress.current = undefined;
        isDown.current = false;
    }, []);

    const bind = useCallback(() => {
        return {
            onPointerDown,
            onPointerUp,
        } as unknown as HtmlHTMLAttributes<HTMLElement>;
    }, [onPointerDown, onPointerUp]);

    return options.disabled ? null : bind;
}
