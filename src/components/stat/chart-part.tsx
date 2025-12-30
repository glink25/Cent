import type { ECElementEvent } from "echarts/core";
import { useCallback, useMemo, useRef, useState } from "react";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCurrency } from "@/hooks/use-currency";
import type { BillFilter } from "@/ledger/extra-type";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import {
    overallTrendOption,
    processBillDataForCharts,
    structureOption,
    userTrendOption,
} from "@/utils/charts";
import CategoryIcon from "../category/icon";
import Chart, { type ChartInstance } from "../chart";
import { Button } from "../ui/button";
import type { FocusType } from "./focus-type";
import { StaticItem } from "./static-item";

export function useChartPart({
    viewType,
    seeDetails,
    focusType,
    filtered,
    dimension,
    displayCurrency,
}: {
    viewType: string;
    seeDetails: (append?: Partial<BillFilter>) => void;
    focusType: FocusType;
    filtered: Bill[];
    dimension: "category" | "user";
    displayCurrency?: string;
}) {
    const t = useIntl();

    const { convert, baseCurrency } = useCurrency();
    const rateToDisplayCurrency = useMemo(() => {
        return displayCurrency
            ? convert(1, displayCurrency, baseCurrency.id).predict
            : 1;
    }, [displayCurrency, baseCurrency.id, convert]);

    const trendChart = useRef<ChartInstance>(undefined);
    // 是否以列表展示而非饼图
    const [asList, setAsList] = useState(false);

    const [selectedCategoryId, setSelectedCategoryId] = useState<string>();
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
                    gap: viewType === "yearly" ? "month" : undefined,
                    displayCurrency,
                    rateToDisplayCurrency,
                },
                t,
            ),
        [
            filtered,
            viewType,
            categories,
            creators,
            displayCurrency,
            rateToDisplayCurrency,
            t,
        ],
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
            setSelectedCategoryId(
                (params.data as Series[number]["data"][number]).id,
            );
        }
    }, []);
    const selectedCategory = useMemo(() => {
        return categories.find((c) => c.id === selectedCategoryId);
    }, [categories, selectedCategoryId]);

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
                <div className="flex-shrink-0 w-full border rounded-md relative">
                    <div className="absolute top-4 left-4 z-2">
                        {
                            <button
                                type="button"
                                className={cn(
                                    "inline-flex justify-center items-center p-1 rounded-full",
                                    asList && "bg-foreground text-background",
                                )}
                                onClick={() => {
                                    setAsList((v) => !v);
                                }}
                            >
                                <i
                                    className={cn(
                                        "icon-[mdi--format-list-bulleted] cursor-pointer",
                                    )}
                                ></i>
                            </button>
                        }
                    </div>
                    {asList ? (
                        <div className="w-full">
                            <div className="py-4 flex justify-center font-semibold text-lg">
                                {focusType === "income"
                                    ? t("income-details")
                                    : t("expense-details")}
                            </div>
                            <div className="table w-full border-collapse">
                                <div className="table-row-group divide-y">
                                    <ListChart
                                        series={charts[1]?.series as Series}
                                        focusType={focusType}
                                        onItemClick={(v) => {
                                            setSelectedCategoryId(v.id);
                                        }}
                                        onItemMoneyClick={(v) => {
                                            seeDetails({
                                                categories: categories
                                                    .filter(
                                                        (c) =>
                                                            c.id === v.id ||
                                                            c.parent === v.id,
                                                    )
                                                    .map((c) => c.id),
                                            });
                                        }}
                                    />
                                    {selectedCategoryChart && (
                                        <>
                                            <div className="w-full table-row">
                                                <div className="table-cell"></div>
                                                <div className="table-cell font-semibold">
                                                    <div className="flex  h-10 justify-center items-center">
                                                        {selectedCategory?.name}
                                                    </div>
                                                </div>
                                                <div className="table-cell"></div>
                                            </div>
                                            <ListChart
                                                series={
                                                    selectedCategoryChart.series
                                                }
                                                focusType={focusType}
                                                onItemMoneyClick={(v) => {
                                                    seeDetails({
                                                        categories: [v.id],
                                                    });
                                                }}
                                            />
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
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
                    )}
                </div>
            )}
            {!asList && selectedCategoryChart && (
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
        setSelectedCategoryId,
    };
}

type Series = {
    data: { value: number; name: string; id: string }[];
}[];

function ListChart({
    series,
    focusType,
    onItemClick,
    onItemMoneyClick,
}: {
    series?: Series;
    focusType: FocusType;
    onItemClick?: (v: Series[number]["data"][number]) => void;
    onItemMoneyClick?: (v: Series[number]["data"][number]) => void;
}) {
    const { categories } = useCategory();
    const total = series?.[0].data?.reduce((p, c) => p + c.value, 0) ?? 1;
    return (
        <>
            {series?.[0].data.map((v) => {
                const category = categories.find((c) => c.id === v.id);
                return (
                    <StaticItem
                        key={v.id}
                        money={v.value}
                        percent={v.value / total}
                        type={focusType}
                        className="h-14"
                        onClick={() => {
                            onItemClick?.(v);
                        }}
                        onMoneyClick={() => {
                            onItemMoneyClick?.(v);
                        }}
                    >
                        <div className="flex justify-center items-center gap-2">
                            {category && (
                                <div className="border size-10 rounded-full p-2 flex justify-center items-center">
                                    <CategoryIcon icon={category?.icon} />
                                </div>
                            )}
                            {category?.name}
                        </div>
                    </StaticItem>
                );
            })}
        </>
    );
}
