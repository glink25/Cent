import dayjs from "dayjs";
import { useMemo, useRef } from "react";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import CloudLoopIcon from "@/assets/icons/cloud-loop.svg?react";
import AnimatedNumber from "@/components/animated-number";
import BudgetCard from "@/components/budget/card";
import { HintTooltip } from "@/components/hint";
import { PaginationIndicator } from "@/components/indicator";
import Ledger from "@/components/ledger";
import Loading from "@/components/loading";
import { Promotion } from "@/components/promotion";
import { useBudget } from "@/hooks/use-budget";
import { useSnap } from "@/hooks/use-snap";
import { amountToNumber } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { filterOrderedBillListByTimeRange } from "@/utils/filter";

export default function Page() {
    const t = useIntl();

    const { bills, loading, sync } = useLedgerStore();
    const currentBook = useBookStore(
        useShallow((state) => {
            const { currentBookId, books } = state;
            return books.find((b) => b.id === currentBookId);
        }),
    );
    const { id: userId } = useUserStore();
    const syncIconClassName =
        sync === "wait"
            ? "icon-[mdi--cloud-minus-outline]"
            : sync === "syncing"
              ? "icon-[line-md--cloud-alt-print-loop]"
              : sync === "success"
                ? "icon-[mdi--cloud-check-outline]"
                : "icon-[mdi--cloud-remove-outline]";

    const todayBills = useMemo(() => {
        const now = dayjs();
        const today = filterOrderedBillListByTimeRange(bills, [
            now.startOf("day"),
            now.endOf("day"),
        ]);
        return today;
    }, [bills]);

    const todayAmount = useMemo(() => {
        return amountToNumber(
            todayBills.reduce((p, c) => {
                return p + c.amount * (c.type === "income" ? 1 : -1);
            }, 0),
        );
    }, [todayBills]);

    const { budgets: allBudgets } = useBudget();
    const budgets = allBudgets.filter((b) => b.joiners.includes(userId));

    const budgetContainer = useRef<HTMLDivElement>(null);
    const { count: budgetCount, index: curBudgetIndex } = useSnap(
        budgetContainer,
        0,
    );
    return (
        <div className="w-full h-full p-2 flex flex-col overflow-hidden">
            <div className="flex flex-wrap flex-col w-full gap-2">
                <div className="bg-stone-800 text-background dark:bg-foreground/20 dark:text-foreground relative h-20 w-full flex justify-end rounded-lg sm:flex-1 p-4">
                    <span className="absolute top-2 left-4">{t("Today")}</span>
                    <AnimatedNumber
                        value={todayAmount}
                        className="font-bold text-4xl "
                    />
                    {currentBook && (
                        <button
                            type="button"
                            className="absolute bottom-2 left-4 text-xs opacity-60 flex items-center gap-1 cursor-pointer"
                            onClick={() => {
                                useBookStore.setState((prev) => ({
                                    ...prev,
                                    visible: true,
                                }));
                            }}
                        >
                            <i className="icon-[mdi--book]"></i>
                            {currentBook.name}
                        </button>
                    )}
                </div>
                <Promotion />
                <div className="w-full flex flex-col gap-1">
                    <div
                        ref={budgetContainer}
                        className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x"
                    >
                        {budgets.map((budget) => {
                            return (
                                <BudgetCard
                                    className="flex-shrink-0 snap-start"
                                    key={budget.id}
                                    budget={budget}
                                />
                            );
                        })}
                    </div>
                </div>
            </div>
            <div className="flex justify-between items-center pl-7 pr-5 py-1">
                <button
                    className="cursor-pointer"
                    type="button"
                    onClick={() => {
                        if (loading) {
                            return;
                        }
                        useLedgerStore.getState().initCurrentBook();
                    }}
                >
                    <div className={cn("opacity-0", loading && "opacity-100")}>
                        <Loading />
                    </div>
                </button>
                <div>
                    {budgetCount > 1 && (
                        <PaginationIndicator
                            count={budgetCount}
                            current={curBudgetIndex}
                        />
                    )}
                </div>
                <HintTooltip
                    persistKey={"cloudSyncHintShows"}
                    content={"等待云同步完成后，其他设备即可获取最新的账单数据"}
                >
                    <button
                        type="button"
                        className="cursor-pointer"
                        onClick={() => {
                            StorageAPI.toSync();
                        }}
                    >
                        {sync === "syncing" ? (
                            <CloudLoopIcon width={16} height={16} />
                        ) : (
                            <i className={syncIconClassName}></i>
                        )}
                    </button>
                </HintTooltip>
            </div>
            <div className="flex-1 translate-0 pb-[10px] overflow-hidden">
                <div className="w-full h-full">
                    {bills.length > 0 ? (
                        <Ledger
                            bills={bills}
                            className={cn(bills.length > 0 && "relative")}
                            enableDivideAsOrdered
                            showTime
                        />
                    ) : (
                        <div className="text-xs p-4 text-center">
                            {t("nothing-here-add-one-bill")}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
