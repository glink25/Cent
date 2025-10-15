import type { ReactNode } from "react";
import { cn } from "@/utils";

export default function Deletable({
    children,
    icon,
    className,
    onDelete,
}: {
    children?: ReactNode;
    icon?: ReactNode;
    className?: string;
    onDelete?: () => void;
}) {
    if (!children) {
        return null;
    }
    return (
        <div className={cn("relative", className)}>
            {children}
            <button
                className="delete-button cursor-pointer absolute top-0 right-0 w-4 h-4 flex justify-center items-center translate-x-[30%] -translate-y-[30%] rounded-full bg-destructive"
                type="button"
                onClick={onDelete}
            >
                {icon ?? (
                    <i className="icon-[mdi--close] text-white size-3"></i>
                )}
            </button>
        </div>
    );
}
