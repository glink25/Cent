/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
import { cn } from "@/utils";
import { toFixed } from "@/utils/number";
import Money from "../money";
import { Progress } from "../ui/progress";
import type { FocusType } from "./focus-type";

export function TagItem({
    name,
    money,
    total,
    type,
    onClick,
}: {
    name: string;
    money: number;
    total: number;
    type: FocusType;
    onClick?: () => void;
}) {
    const percent = total === 0 ? 0 : money / total;
    return (
        <div
            className="w-full items-center cursor-pointer table-row h-10 rounded transition-all hover:bg-accent hover:text-accent-foreground"
            onClick={onClick}
        >
            <div className="text-sm truncate text-left table-cell w-[1px] align-middle pl-2">
                #{name}
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
                                ? "bg-red-700"
                                : type === "income"
                                  ? "bg-green-700"
                                  : "bg-stone-700",
                        )}
                        style={{ width: `${percent * 100}%` }}
                    >
                        {toFixed(percent * 100, 2)}%
                    </div>
                </Progress>
            </div>
            <div className="w-[1px] truncate text-right table-cell align-middle pr-2">
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
