import type { PointerEventHandler } from "react";

export default function KeyboardHeightHandle({
    onPointerDown,
    onPointerMove,
    onPointerUp,
}: {
    onPointerDown: PointerEventHandler<HTMLDivElement>;
    onPointerMove: PointerEventHandler<HTMLDivElement>;
    onPointerUp: PointerEventHandler<HTMLDivElement>;
}) {
    return (
        <div className="flex justify-center">
            <div
                className="flex h-4 w-16 touch-none select-none items-center justify-center rounded-full cursor-row-resize"
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
            >
                <div className="h-1 w-12 rounded-full bg-white/25" />
            </div>
        </div>
    );
}
