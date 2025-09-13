import type { ReactNode } from "react";
import { cn } from "@/utils";

export default function PopupLayout({
    title,
    children,
    onBack,
    className,
}: {
    title?: string;
    children?: ReactNode;
    onBack?: () => void;
    className?: string;
}) {
    return (
        <div className={cn("flex-1 flex flex-col overflow-hidden", className)}>
            <div className="flex justify-center items-center relative px-4 pt-4 pb-2 flex-shrink-0">
                <button
                    type="button"
                    className="absolute left-0 flex buttoned rounded-full py-1 pl-1 pr-3 cursor-pointer"
                    onClick={() => {
                        onBack?.();
                    }}
                >
                    <div className="flex items-center justify-center">
                        <i className="icon-[mdi--chevron-left] size-5"></i>
                    </div>
                    {"back"}
                </button>
                <div className="h-4">{title}</div>
            </div>
            {children}
        </div>
    );
}
