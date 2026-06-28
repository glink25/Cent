import type { MouseEventHandler } from "react";
import type { BillCategory } from "@/ledger/type";
import { cn } from "@/utils";
import CategoryIcon from "./icon";

export function CategoryItem({
    category,
    selected,
    onMouseDown,
    onClick,
    className,
}: {
    category: BillCategory;
    selected?: boolean;
    onMouseDown?: MouseEventHandler<HTMLButtonElement>;
    onClick?: MouseEventHandler<HTMLButtonElement>;
    className?: string;
}) {
    return (
        <button
            type="button"
            className={cn(
                `rounded-lg border py-2 px-3 min-h-[40px] flex items-center justify-center gap-2 cursor-pointer`,
                selected
                    ? "bg-slate-700 text-white "
                    : "bg-stone-200  text-light-900 dark:bg-stone-500",
                className,
            )}
            onMouseDown={onMouseDown}
            onClick={onClick}
        >
            <CategoryIcon
                icon={category.icon}
                className="w-4 h-4 flex-shrink-0"
            />
            <div className="text-sm break-words text-center">
                {category.name}
            </div>
        </button>
    );
}
