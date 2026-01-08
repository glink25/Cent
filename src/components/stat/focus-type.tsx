import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { toFixed, toThousand } from "@/utils/number";
import Money from "../money";

export const FocusTypes = ["income", "expense", "balance"] as const;
export type FocusType = (typeof FocusTypes)[number];

export function FocusTypeSelector({
    value: focusType,
    onValueChange: setFocusType,
    money,
}: {
    value: FocusType;
    onValueChange: (v: FocusType) => void;
    money: number[];
}) {
    const t = useIntl();
    const btnClass = `min-w-[90px] text-sm py-1 flex items-center justify-center  cursor-pointer transition-all duration-200`;
    return (
        <div className="flex items-center rounded-md shadow border border-input overflow-hidden divide-x">
            <button
                type="button"
                className={cn(
                    btnClass,
                    focusType === "income" &&
                        "!bg-stone-700 !text-white [&_span]:text-semantic-income-medium",
                )}
                onClick={() => {
                    setFocusType("income");
                }}
            >
                <div className="flex flex-col items-center justify-center">
                    <span className="text-semantic-income">
                        +<Money value={money[0]} />
                    </span>
                    <div className="text-[10px] opacity-60"> {t("income")}</div>
                </div>
            </button>
            <button
                type="button"
                className={cn(
                    btnClass,
                    focusType === "expense" &&
                        "!bg-stone-700 !text-white [&_span]:text-semantic-expense-medium",
                )}
                onClick={() => setFocusType("expense")}
            >
                <div className="flex flex-col items-center justify-center">
                    <span className="text-semantic-expense">
                        -<Money value={money[1]} />
                    </span>
                    <div className="text-[10px] opacity-60">{t("expense")}</div>
                </div>
            </button>
            <button
                type="button"
                className={cn(
                    btnClass,
                    focusType === "balance" && "!bg-stone-700 !text-white",
                )}
                onClick={() => setFocusType("balance")}
            >
                <div className="flex flex-col items-center justify-center">
                    <span>
                        <Money value={money[2]} />
                    </span>
                    <div className="text-[10px] opacity-60">{t("Balance")}</div>
                </div>
            </button>
        </div>
    );
}
