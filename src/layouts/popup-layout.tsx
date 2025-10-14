import type { ReactNode } from "react";
import { useIntl } from "@/locale";
import { cn } from "@/utils";

export default function PopupLayout({
    title,
    children,
    onBack,
    className,
    hideBack,
    right,
}: {
    title?: string | ReactNode;
    children?: ReactNode;
    onBack?: () => void;
    className?: string;
    hideBack?: boolean;
    right?: ReactNode;
}) {
    const t = useIntl();
    return (
        <div
            className={cn(
                "flex-1 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]",
                className,
            )}
        >
            <div className="w-full flex justify-center items-center relative px-4 pt-4 pb-2 flex-shrink-0">
                {!hideBack && (
                    <button
                        type="button"
                        className="absolute left-0 flex buttoned rounded-full py-1 pl-1 pr-3 cursor-pointer"
                        onClick={(e) => {
                            onBack?.();
                            e.stopPropagation();
                        }}
                    >
                        <div className="flex items-center justify-center">
                            <i className="icon-[mdi--chevron-left] size-5"></i>
                        </div>
                        {t("back")}
                    </button>
                )}
                {right && <div className="absolute right-0 pr-1">{right}</div>}
                <div className="min-h-4 w-full flex justify-center items-center">
                    {title}
                </div>
            </div>
            {children}
        </div>
    );
}
