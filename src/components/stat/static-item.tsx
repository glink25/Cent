/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */

import type { ReactNode } from "react";
import { cn } from "@/utils";
import { toFixed } from "@/utils/number";
import Money from "../money";
import { Progress } from "../ui/progress";
import type { FocusType } from "./focus-type";

export function StaticItem({
    children,
    money,
    percent,
    type,
    onClick,
    onMoneyClick,
    className,
}: {
    children: ReactNode;
    money: number;
    percent: number;
    type: FocusType;
    onClick?: () => void;
    onMoneyClick?: () => void;
    className?: string;
}) {
    return (
        <div
            className={cn(
                "w-full items-center cursor-pointer table-row h-10 rounded transition-all hover:bg-accent hover:text-accent-foreground",
                className,
            )}
            onClick={onClick}
        >
            <div className="text-sm truncate text-left table-cell w-[1px] align-middle pl-2">
                {children}
            </div>
            <div className="table-cell w-auto px-2 align-middle">
                <Progress
                    value={percent * 100}
                    className="h-3 [&_[data-state=indeterminate]]:hidden min-w-[1px]"
                >
                    <div
                        className={cn(
                            "absolute top-0 text-[8px] px-2 rounded-full min-w-min h-full flex items-center justify-end text-white",
                            type === "expense"
                                ? "bg-semantic-expense"
                                : type === "income"
                                  ? "bg-semantic-income"
                                  : "bg-stone-700",
                        )}
                        style={{ width: `${percent * 100}%` }}
                    >
                        {toFixed(percent * 100, 2)}%
                    </div>
                </Progress>
            </div>
            <div
                className="w-[1px] truncate text-right table-cell align-middle pr-2"
                onClick={(e) => {
                    onMoneyClick?.();
                }}
            >
                <div className="flex items-center w-full">
                    <div className="flex-1 gap-1">
                        {type === "expense"
                            ? "-"
                            : type === "income"
                              ? "+"
                              : ""}
                        <Money value={money} />
                    </div>
                    <i className="icon-[mdi--arrow-up-right]"></i>
                </div>
            </div>
        </div>
    );
}

export function TagItem({
    name,
    total,
    ...props
}: {
    name: string;
    money: number;
    total: number;
    type: FocusType;
    onClick?: () => void;
}) {
    const percent = total === 0 ? 0 : props.money / total;
    return (
        <StaticItem percent={percent} {...props}>
            #{name}
        </StaticItem>
    );
}
