/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */

import dayjs from "dayjs";
import { Collapsible } from "radix-ui";
import { useMemo } from "react";
import useCategory from "@/hooks/use-category";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils";
import { showBudgetDetail } from "./detail";
import { BudgetBar } from "./detail-form";
import type { Budget } from "./type";
import { useBudgetDetail } from "./use-budget-detail";
import { budgetEncountered } from "./util";

export default function BudgetCard({
    className,
    budget,
}: {
    className?: string;
    budget: Budget;
}) {
    const t = useIntl();
    const { bills } = useLedgerStore();
    const { total, currentRange } = useBudgetDetail(budget);
    const { categories } = useCategory();
    const encountered = useMemo(
        () =>
            currentRange
                ? budgetEncountered(budget, bills, currentRange, categories)
                : undefined,
        [budget, bills, currentRange, categories],
    );

    const todayEncountered = useMemo(
        () =>
            currentRange
                ? budgetEncountered(
                      budget,
                      bills,
                      [dayjs().startOf("day"), dayjs().endOf("day")],
                      categories,
                  )
                : undefined,
        [budget, bills, currentRange, categories],
    );

    const time = useMemo(() => {
        if (!currentRange) {
            return undefined;
        }
        const now = dayjs();
        const spend = now.diff(currentRange[0]);
        const duration = currentRange[1].diff(currentRange[0]);
        const totalDays = dayjs.duration(duration).asDays();
        const spendDays = dayjs.duration(spend).asDays();
        const leftDays = Math.max(0, totalDays - spendDays);
        return { percent: spend / duration, leftDays, totalDays };
    }, [currentRange]);

    if (!encountered) {
        return (
            <div
                className={cn(
                    "rounded-lg border flex flex-col w-full px-4 py-2 cursor-pointer",
                    className,
                )}
                onClick={() => {
                    showBudgetDetail(budget);
                }}
            >
                <div className="font-semibold">{budget.title}</div>
                <div className="text-xs opacity-60">{t("budget-finished")}</div>
            </div>
        );
    }

    const CategoryBudgetDetails = (
        <>
            {encountered?.categoriesUsed?.map((v) => {
                const category = categories.find((c) => c.id === v.id);
                const total =
                    budget.categoriesBudget?.find((c) => c.id === v.id)
                        ?.budget ?? 0;
                const td = todayEncountered?.categoriesUsed?.find(
                    (c) => c.id === v.id,
                );
                return (
                    <div key={v.id}>
                        {category?.name}
                        <BudgetBar
                            total={total}
                            used={v.used}
                            todayUsed={td?.used}
                            time={time}
                        />
                    </div>
                );
            })}
        </>
    );
    return (
        <div
            className={cn(
                "rounded-lg border flex flex-col w-full px-4 py-2 cursor-pointer",
                className,
            )}
            onClick={() => {
                showBudgetDetail(budget);
            }}
        >
            <Collapsible.Root className="group">
                <div className="w-full flex items-center justify-between">
                    <div className="font-semibold">{budget.title}</div>
                    <div className="text-sm">
                        {todayEncountered && time && (
                            <>
                                {t("today-left")}:
                                {(
                                    total / time.totalDays -
                                    todayEncountered.totalUsed
                                ).toFixed(2)}
                            </>
                        )}
                    </div>
                </div>
                {budget.totalBudget !== 0 ? (
                    <div className="flex flex-col">
                        <BudgetBar
                            total={total}
                            used={encountered.totalUsed}
                            todayUsed={todayEncountered?.totalUsed}
                            time={time}
                        />
                        <div>
                            {(encountered?.categoriesUsed?.length ?? 0) > 0 && (
                                <Collapsible.Trigger
                                    className="h-4 flex justify-end w-full group"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                    }}
                                >
                                    <i className=" group-[[data-state=open]]:icon-[mdi--chevron-down] group-[[data-state=closed]]:icon-[mdi--chevron-up]" />
                                </Collapsible.Trigger>
                            )}
                        </div>
                        <Collapsible.Content className="data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
                            {CategoryBudgetDetails}
                        </Collapsible.Content>
                    </div>
                ) : (
                    CategoryBudgetDetails
                )}
            </Collapsible.Root>
        </div>
    );
}
