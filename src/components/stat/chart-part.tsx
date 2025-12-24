import type { ECElementEvent } from "echarts/core";
import { useCallback, useMemo, useRef, useState } from "react";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import type { BillFilter } from "@/ledger/extra-type";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import {
    overallTrendOption,
    processBillDataForCharts,
    structureOption,
    userTrendOption,
} from "@/utils/charts";
import Chart, { type ChartInstance } from "../chart";
import { Button } from "../ui/button";
import type { FocusType } from "./focus-type";

export function useChartPart({
    selectedViewId,
    seeDetails,
    focusType,
    filtered,
    dimension,
}: {
    selectedViewId: string;
    seeDetails: (append?: Partial<BillFilter>) => void;
    focusType: FocusType;
    filtered: Bill[];
    dimension: "category" | "user";
}) {
    const t = useIntl();

    const trendChart = useRef<ChartInstance>(undefined);

    const [selectedCategoryName, setSelectedCategoryName] = useState<string>();
    const { categories } = useCategory();
    const creators = useCreators();
    const dataSources = useMemo(
        () =>
            processBillDataForCharts(
                {
                    bills: filtered,
                    getCategory: (id) => {
                        const cate = categories.find((c) => c.id === id);
                        if (!cate?.parent) {
                            return cate
                                ? { ...cate, parent: { ...cate } }
                                : { id, name: id, parent: { id, name: id } };
                        }
                        const parent = categories.find(
                            (c) => c.id === cate.parent,
                        )!;
                        return { ...cate, parent };
                    },
                    getUserInfo: (id) => {
                        return {
                            id,
                            name:
                                creators.find((u) => `${u.id}` === id)?.name ??
                                `${id}`,
                        };
                    },
                    gap: selectedViewId === "yearly" ? "month" : undefined,
                },
                t,
            ),
        [filtered, selectedViewId, categories, creators, t],
    );
    const charts = useMemo(() => {
        if (dimension === "category") {
            const incomeName = dataSources.overallTrend.source?.[0]?.[1];
            const expenseName = dataSources.overallTrend.source?.[0]?.[2];
            const balanceName = dataSources.overallTrend.source?.[0]?.[3];

            return [
                overallTrendOption(dataSources.overallTrend, {
                    title: {
                        text: t("overall-trend"),
                    },
                    legend: {
                        selected: {
                            [incomeName]: focusType === "income",
                            [expenseName]: focusType === "expense", // 默认选中（显示）
                            [balanceName]: focusType === "balance",
                        },
                    },
                }),
                focusType === "expense"
                    ? structureOption(dataSources.expenseStructure, {
                          title: { text: t("expense-structure") },
                      })
                    : focusType === "income"
                      ? structureOption(dataSources.incomeStructure, {
                            title: { text: t("income-structure") },
                        })
                      : structureOption(dataSources.expenseStructure, {
                            title: { text: t("expense-structure") },
                        }),
            ];
        }
        return [
            focusType === "expense"
                ? userTrendOption(dataSources.userExpenseTrend, {
                      title: { text: t("users-expense-trend") },
                  })
                : focusType === "income"
                  ? userTrendOption(dataSources.userIncomeTrend, {
                        title: { text: t("users-income-trend") },
                    })
                  : userTrendOption(dataSources.userBalanceTrend, {
                        title: { text: t("users-balance-trend") },
                    }),
            focusType === "expense"
                ? structureOption(dataSources.userExpenseStructure, {
                      title: { text: t("expense-structure") },
                  })
                : focusType === "income"
                  ? structureOption(dataSources.userIncomeStructure, {
                        title: { text: t("income-structure") },
                    })
                  : structureOption(dataSources.userBalanceStructure, {
                        title: { text: t("expense-structure") },
                    }),
        ];
    }, [
        dimension,
        focusType,
        dataSources.overallTrend,
        dataSources.incomeStructure,
        dataSources.expenseStructure,
        dataSources.userIncomeStructure,
        dataSources.userExpenseStructure,
        dataSources.userBalanceStructure,
        dataSources.userBalanceTrend,
        dataSources.userExpenseTrend,
        dataSources.userIncomeTrend,
        t,
    ]);
    const onStructureChartClick = useCallback((params: ECElementEvent) => {
        if (params.componentType === "series" && params.seriesType === "pie") {
            setSelectedCategoryName(params.name);
        }
    }, []);
    const selectedCategory = useMemo(() => {
        return categories.find((c) => c.name === selectedCategoryName);
    }, [categories, selectedCategoryName]);

    const selectedCategoryChart = useMemo(() => {
        if (dimension !== "category") {
            return undefined;
        }
        if (!selectedCategory) {
            return undefined;
        }
        const data = dataSources.subCategoryStructure[selectedCategory.id];
        if (!data) {
            return undefined;
        }
        return structureOption(data, {
            title: { text: selectedCategory.name },
        });
    }, [dimension, dataSources.subCategoryStructure, selectedCategory]);

    const Part = (
        <>
            <div className="flex-shrink-0 w-full h-[300px]">
                <Chart
                    ref={trendChart}
                    key={dimension}
                    option={charts[0]}
                    className="w-full h-full border rounded-md"
                />
            </div>
            {focusType !== "balance" && (
                <div className="flex-shrink-0 w-full border rounded-md">
                    <div className="w-full">
                        <Chart
                            key={dimension}
                            option={charts[1]}
                            className="w-full h-[300px] "
                            onClick={onStructureChartClick}
                        />
                        <div className="flex justify-end p-1">
                            <Button
                                variant="ghost"
                                size={"sm"}
                                onClick={() => {
                                    seeDetails({
                                        type: focusType,
                                    });
                                }}
                            >
                                {focusType === "expense"
                                    ? t("see-expense-ledgers")
                                    : t("see-income-ledgers")}
                                <i className="icon-[mdi--arrow-up-right]"></i>
                            </Button>
                        </div>
                    </div>
                </div>
            )}
            {selectedCategoryChart && (
                <div className="flex-shrink-0 w-full border rounded-md">
                    <div className="w-full h-[300px]">
                        <Chart
                            option={selectedCategoryChart}
                            className="w-full h-full "
                        />
                    </div>
                    <div className="flex justify-end p-1">
                        <Button
                            variant="ghost"
                            size={"sm"}
                            onClick={() => {
                                if (selectedCategory) {
                                    seeDetails({
                                        categories: [selectedCategory?.id],
                                    });
                                }
                            }}
                        >
                            {t("see-category-ledgers")}
                            <i className="icon-[mdi--arrow-up-right]"></i>
                        </Button>
                    </div>
                </div>
            )}
        </>
    );

    return {
        Part,
        dataSources,
        setSelectedCategoryName,
    };
}
