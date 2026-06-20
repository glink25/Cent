import type { HtmlHTMLAttributes, ReactNode } from "react";
import { cn } from "@/utils";

export function BaseButton({
    children,
    className,
    ...props
}: { children?: ReactNode } & HtmlHTMLAttributes<HTMLButtonElement>) {
    return (
        <button
            type="button"
            className={cn(
                "w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-stone-900 shadow-md flex items-center justify-center m-1 cursor-pointer transform transition-all hover:scale-105",
                className,
            )}
            {...props}
        >
            {children}
        </button>
    );
}
