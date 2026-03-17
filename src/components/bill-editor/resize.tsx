import { type PointerEventHandler, useRef } from "react";
import { useIsDesktop } from "@/hooks/use-media-query";
import { usePreferenceStore } from "@/store/preference";

export default function ResizeHandle() {
    const startRef = useRef<
        | {
              position: { x: number; y: number };
              bekh: number;
              keyboardBound: DOMRect;
          }
        | undefined
    >(undefined);
    const isDesktop = useIsDesktop();
    const onPointerDown: PointerEventHandler<HTMLDivElement> = (e) => {
        const parent = (e.target as HTMLDivElement).parentElement;
        if (!parent) {
            return;
        }
        e.currentTarget.setPointerCapture(e.pointerId);
        const initialHeight =
            (usePreferenceStore.getState().keyboardHeight ?? 50) / 100;
        startRef.current = {
            position: {
                x: e.clientX,
                y: e.clientY,
            },
            bekh: initialHeight,
            keyboardBound: parent.getBoundingClientRect(),
        };
    };
    const onPointerMove: PointerEventHandler<HTMLDivElement> = (e) => {
        if (startRef.current === undefined) {
            return;
        }
        const { keyboardBound } = startRef.current;
        const newKeyboardHeight = keyboardBound.bottom - e.clientY;
        const newBekh = isDesktop
            ? (newKeyboardHeight - 380) / 160 + 0.5 //sm:h-[calc(380px+160px*(var(--bekh,0.5)-0.5))
            : (newKeyboardHeight - 480) / 160 + 0.5; //h-[calc(480px+160px*(var(--bekh,0.5)-0.5))]

        const nextBekh = Math.min(1, Math.max(0.01, newBekh));
        usePreferenceStore.setState((prev) => ({
            ...prev,
            keyboardHeight: nextBekh * 100,
        }));
    };
    const onPointerUp: PointerEventHandler<HTMLDivElement> = (e) => {
        if (startRef.current === undefined) {
            return;
        }
        e.currentTarget.releasePointerCapture(e.pointerId);
        startRef.current = undefined;
    };

    return (
        <div
            className="touch-none absolute z-[2] left-0 top-[-10px] w-full h-[20px] cursor-ns-resize flex justify-center items-center"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
        >
            <div className="pointer-events-none h-[6px] w-14 rounded-full bg-background border" />
        </div>
    );
}
