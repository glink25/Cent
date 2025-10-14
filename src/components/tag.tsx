import type { ButtonHTMLAttributes, DetailedHTMLProps, ReactNode } from "react";
import { cn } from "@/utils";

export default function Tag({
    checked,
    children,
    onCheckedChange,
    className,
    ...props
}: {
    checked?: boolean;
    children: ReactNode;
    className?: string;
    onCheckedChange?: (v: boolean) => void;
} & DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
>) {
    return (
        <button
            type="button"
            {...props}
            data-state={checked ? "checked" : "uncheck"}
            className={cn(
                `rounded-md border py-1 px-2 flex items-center justify-center whitespace-nowrap cursor-pointer`,
                "data-[state=checked]:bg-slate-700 data-[state=checked]:text-white bg-stone-200  text-light-900",
                className,
            )}
            onMouseDown={() => {
                onCheckedChange?.(!checked);
            }}
        >
            {children}
        </button>
    );
}
