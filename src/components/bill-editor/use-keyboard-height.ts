import {
    type PointerEvent,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { useIsDesktop } from "@/hooks/use-media-query";
import { usePreferenceStore } from "@/store/preference";

type KeyboardHeightBounds = {
    min: number;
    max: number;
};

const normalizeKeyboardHeightPercent = (value: number) =>
    Math.max(0, Math.min(100, Math.round(value)));

const getKeyboardHeightBounds = (isDesktop: boolean): KeyboardHeightBounds => {
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    if (isDesktop) {
        return {
            min: 280,
            max: Math.min(
                460,
                Math.max(360, Math.round(viewportHeight * 0.56)),
            ),
        };
    }
    const min = Math.round(Math.min(300, Math.max(280, viewportHeight * 0.36)));
    const max = Math.round(
        Math.min(520, Math.max(min + 100, viewportHeight * 0.62)),
    );
    return { min, max };
};

const getKeyboardHeight = (percent: number, bounds: KeyboardHeightBounds) => {
    const ratio = normalizeKeyboardHeightPercent(percent) / 100;
    return Math.round(bounds.min + (bounds.max - bounds.min) * ratio);
};

const setKeyboardHeightPercent = (value: number) => {
    const next = normalizeKeyboardHeightPercent(value);
    usePreferenceStore.setState((prev) => ({
        ...prev,
        keyboardHeight: next,
    }));
};

export function useKeyboardHeight() {
    const isDesktop = useIsDesktop();
    const keyboardHeightPercent = usePreferenceStore((state) =>
        normalizeKeyboardHeightPercent(state.keyboardHeight ?? 50),
    );
    const [keyboardHeightBounds, setKeyboardHeightBounds] = useState(() =>
        getKeyboardHeightBounds(isDesktop),
    );
    const keyboardDragRef = useRef<{
        pointerId: number;
        startY: number;
        startPercent: number;
    } | null>(null);

    useEffect(() => {
        const updateBounds = () => {
            setKeyboardHeightBounds(getKeyboardHeightBounds(isDesktop));
        };
        updateBounds();

        const viewport = window.visualViewport;
        window.addEventListener("resize", updateBounds);
        viewport?.addEventListener("resize", updateBounds);

        return () => {
            window.removeEventListener("resize", updateBounds);
            viewport?.removeEventListener("resize", updateBounds);
        };
    }, [isDesktop]);

    const keyboardHeight = useMemo(
        () => getKeyboardHeight(keyboardHeightPercent, keyboardHeightBounds),
        [keyboardHeightBounds, keyboardHeightPercent],
    );

    const updateKeyboardDrag = useCallback(
        (clientY: number) => {
            const drag = keyboardDragRef.current;
            if (!drag) {
                return;
            }
            const distance =
                keyboardHeightBounds.max - keyboardHeightBounds.min;
            if (distance <= 0) {
                return;
            }
            setKeyboardHeightPercent(
                drag.startPercent + ((drag.startY - clientY) / distance) * 100,
            );
        },
        [keyboardHeightBounds],
    );

    const onPointerDown = useCallback(
        (e: PointerEvent<HTMLDivElement>) => {
            keyboardDragRef.current = {
                pointerId: e.pointerId,
                startY: e.clientY,
                startPercent: keyboardHeightPercent,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
        },
        [keyboardHeightPercent],
    );

    const onPointerMove = useCallback(
        (e: PointerEvent<HTMLDivElement>) => {
            if (keyboardDragRef.current?.pointerId !== e.pointerId) {
                return;
            }
            updateKeyboardDrag(e.clientY);
        },
        [updateKeyboardDrag],
    );

    const onPointerUp = useCallback(
        (e: PointerEvent<HTMLDivElement>) => {
            if (keyboardDragRef.current?.pointerId !== e.pointerId) {
                return;
            }
            updateKeyboardDrag(e.clientY);
            keyboardDragRef.current = null;
            e.currentTarget.releasePointerCapture(e.pointerId);
        },
        [updateKeyboardDrag],
    );

    return {
        keyboardHeight,
        keyboardHeightPercent,
        onPointerDown,
        onPointerMove,
        onPointerUp,
    };
}
