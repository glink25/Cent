/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
import dayjs from "dayjs";
import type { ECElementEvent } from "echarts/core";
import { Switch } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useShallow } from "zustand/shallow";
import { StorageDeferredAPI } from "@/api/storage";
import type { AnalysisResult } from "@/api/storage/analysis";
import { BillFilterProvider, showBillFilter } from "@/components/bill-filter";
import { DateInput } from "@/components/bill-filter/form";
import { showBillInfo } from "@/components/bill-info";
import Chart, { type ChartInstance } from "@/components/chart";
import BillItem from "@/components/ledger/item";
import { showSortableList } from "@/components/sortable";
import { AnalysisCloud } from "@/components/stat/analysic-cloud";
import { AnalysisDetail } from "@/components/stat/analysis-detail";
import {
    type FocusType,
    FocusTypeSelector,
    FocusTypes,
} from "@/components/stat/focus-type";
import { TagItem } from "@/components/stat/tag-item";
import { Button } from "@/components/ui/button";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCustomFilters } from "@/hooks/use-custom-filters";
import { useTag } from "@/hooks/use-tag";
import type { Bill, BillFilter } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils";
import {
    overallTrendOption,
    processBillDataForCharts,
    structureOption,
    userTrendOption,
} from "@/utils/charts";

const StaticViews = [
    // { id: "daily", label: "stat-view-daily" },
    { id: "weekly", label: "stat-view-weekly" },
    { id: "monthly", label: "stat-view-monthly" },
    { id: "yearly", label: "stat-view-yearly" },
    { id: "custom", label: "stat-view-custom" },
] as const;

type Views = {
    id: string;
    label: string;
    filter?: BillFilter;
};

export default function Page() {
    const t = useIntl();
    const { id } = useParams();
    const { bills } = useLedgerStore();
    const endTime = Date.now(); //bills[0]?.time ?? dayjs();
    const startTime = bills[bills.length - 1]?.time ?? dayjs();
    const START = useMemo(() => dayjs.unix(startTime / 1000), [startTime]);
    const END = useMemo(
        () => dayjs.unix(endTime / 1000).endOf("date"),
        [endTime],
    );

    const customFilters = useLedgerStore(
        useShallow((state) => state.infos?.meta.customFilters),
    );
    const views: Views[] = useMemo(() => {
        return [
            ...StaticViews.map((v) => ({ ...v, label: t(v.label) })),
            ...(customFilters?.map((v) => ({ ...v, label: v.name })) ?? []),
        ];
    }, [customFilters, t]);
    const [selectedViewId, setSelectedViewId] = useState(id ?? "monthly");

    const slices = useMemo(() => {
        const labels = (() => {
            if (selectedViewId === "weekly") {
                return {
                    unit: "week",
                    labelThis: t("this-week"),
                    labelLast: t("last-week"),
                    format: "MM-DD",
                    max: 4,
                } as const;
            }
            if (selectedViewId === "monthly") {
                return {
                    unit: "month",
                    labelThis: t("this-month"),
                    labelLast: t("last-month"),
                    format: "YYYY-MM",
                } as const;
            }
            if (selectedViewId === "yearly") {
                return {
                    unit: "year",
                    labelThis: t("this-year"),
                    labelLast: t("last-year"),
                    format: "YYYY",
                } as const;
            }
        })();
        if (labels === undefined) {
            return [];
        }
        const { unit, labelThis, labelLast, format, max } = labels;
        let end = END;
        let start = end.startOf(unit);
        const s = [];
        s.push({
            label: labelThis,
            end: end,
            start: start,
        });

        let i = 0;
        while (true && i < (max ?? Infinity)) {
            i += 1;
            end = start;
            start = end.subtract(1, unit);
            if (end.isAfter(START)) {
                s.push({
                    end,
                    start,
                    label: i === 1 ? labelLast : start.format(format),
                });
            } else {
                break;
            }
        }
        return s;
    }, [selectedViewId, END, START, t]);

    const [selectedSlice, setSelectedSlice] = useState(slices[0]?.label);

    useEffect(() => {
        setSelectedSlice(slices[0]?.label);
    }, [slices[0]?.label]);

    const [customEnd, setCustomEnd] = useState<number | undefined>(undefined);
    const [customStart, setCustomStart] = useState<number | undefined>(
        undefined,
    );

    const [filtered, setFiltered] = useState<typeof bills>([]);

    const { updateFilter } = useCustomFilters();

    const view = views.find((v) => v.id === selectedViewId);
    const { filter, viewName } = useMemo(() => {
        if (selectedViewId === "custom") {
            return {
                filter: {
                    start: customStart,
                    end: customEnd,
                } as BillFilter,
            };
        }
        if (["weekly", "monthly", "yearly"].includes(selectedViewId)) {
            const slice = slices.find((s) => s.label === selectedSlice);
            if (!slice) {
                return { filter: undefined };
            }
            return {
                filter: {
                    start: slice.start.unix() * 1000,
                    end: slice.end.unix() * 1000,
                } as BillFilter,
            };
        }
        return { filter: view?.filter, viewName: view?.label };
    }, [
        customEnd,
        customStart,
        selectedSlice,
        selectedViewId,
        slices.find,
        view?.filter,
        view?.label,
    ]);

    const toReOrder = async () => {
        if ((customFilters?.length ?? 0) === 0) {
            return;
        }
        const ordered = await showSortableList(customFilters);
        useLedgerStore.getState().updateGlobalMeta((prev) => {
            prev.customFilters = ordered
                .map((v) => prev.customFilters?.find((c) => c.id === v.id))
                .filter((v) => v !== undefined);
            return prev;
        });
    };

    useEffect(() => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        if (!filter) {
            return;
        }
        StorageDeferredAPI.filter(book, filter).then((result) => {
            setFiltered(result);
        });
    }, [filter]);
    const { incomes: filteredIncomeBills, expenses: filteredExpenseBills } =
        useMemo(() => {
            const incomes: Bill[] = [];
            const expenses: Bill[] = [];
            filtered.forEach((v) => {
                if (v.type === "expense") {
                    expenses.push(v);
                } else {
                    incomes.push(v);
                }
            });
            return {
                incomes,
                expenses,
            };
        }, [filtered]);

    const navigate = useNavigate();
    const seeDetails = (append?: Partial<BillFilter>) => {
        navigate("/search", { state: { filter: { ...filter, ...append } } });
    };

    const { categories } = useCategory();
    const { tags } = useTag();
    const creators = useCreators();

    const trendChart = useRef<ChartInstance>(undefined);

    const [dimension, setDimension] = useState<"category" | "user">("category");
    const [selectedCategoryName, setSelectedCategoryName] = useState<string>();
    const [focusType, setFocusType] = useState<FocusType>("expense");
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

    const [analysis, setAnalysis] = useState<AnalysisResult>();
    const analysisUnit =
        selectedViewId === "yearly"
            ? "year"
            : selectedViewId === "monthly"
              ? "month"
              : selectedViewId === "weekly"
                ? "week"
                : "day";
    useEffect(() => {
        const book = useBookStore.getState().currentBookId;
        if (!book || !filter?.start || !filter?.end) {
            setAnalysis(undefined);
            return;
        }
        if (!analysisUnit) {
            setAnalysis(undefined);
            return;
        }
        StorageDeferredAPI.analysis(
            book,
            [filter.start, filter.end],
            analysisUnit,
            focusType,
        ).then((v) => {
            setAnalysis(v);
        });
    }, [analysisUnit, focusType, filter?.start, filter?.end]);

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

    const tagStructure = useMemo(
        () =>
            Array.from(dataSources.tagStructure.entries())
                .map(([tagId, struct]) => {
                    const tag = tags.find((t) => t.id === tagId);
                    if (!tag) {
                        return undefined;
                    }
                    return {
                        ...tag,
                        ...struct,
                    };
                })
                .filter((v) => v !== undefined),
        [dataSources.tagStructure, tags],
    );
    const totalMoneys = FocusTypes.map((t) => dataSources.total[t]);
    return (
        <div className="w-full h-full p-2 flex flex-col items-center justify-center gap-4 overflow-hidden page-show">
            <div className="w-full mx-2 max-w-[600px] flex flex-col">
                <div className="w-full flex flex-col gap-2">
                    <div className="w-full flex">
                        <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden">
                            {views.map((view) => (
                                <Button
                                    key={view.id}
                                    size={"sm"}
                                    className={cn(
                                        selectedViewId !== view.id &&
                                            "text-primary/50",
                                    )}
                                    variant={
                                        selectedViewId === view.id
                                            ? "default"
                                            : "ghost"
                                    }
                                    onClick={() => {
                                        setSelectedViewId(view.id);
                                    }}
                                >
                                    {view.label}
                                </Button>
                            ))}
                        </div>
                        <div className="">
                            <Button variant="ghost" onClick={toReOrder}>
                                <i className="icon-[mdi--menu-open] size-5"></i>
                            </Button>
                        </div>
                    </div>
                    <div className="flex gap-2 items-center h-9">
                        {slices.length > 0 ? (
                            <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden">
                                {slices.map((slice) => (
                                    <Button
                                        key={slice.label}
                                        variant="ghost"
                                        size="sm"
                                        className={cn(
                                            "text-primary/40 px-2",
                                            selectedSlice === slice.label &&
                                                "text-primary",
                                        )}
                                        onClick={() => {
                                            setSelectedSlice(slice.label);
                                        }}
                                    >
                                        {slice.label}
                                    </Button>
                                ))}
                            </div>
                        ) : selectedViewId === "custom" ? (
                            <div className="flex-1 flex items-center gap-3 text-xs">
                                <DateInput
                                    value={customStart}
                                    type="start"
                                    onChange={setCustomStart}
                                ></DateInput>
                                <div>-</div>
                                <DateInput
                                    value={customEnd}
                                    type="end"
                                    onChange={setCustomEnd}
                                ></DateInput>
                            </div>
                        ) : (
                            <div className="flex-1 text-sm h-8 flex items-center">
                                <Button
                                    variant={"secondary"}
                                    size="sm"
                                    onClick={async () => {
                                        if (!filter) {
                                            return;
                                        }
                                        const id = selectedViewId;
                                        const action = await showBillFilter({
                                            filter,
                                            name: viewName,
                                        });
                                        if (action === "delete") {
                                            await updateFilter(id);
                                            setSelectedViewId("monthly");
                                            return;
                                        }
                                        await updateFilter(id, {
                                            filter: action.filter,
                                            name: action.name,
                                        });
                                    }}
                                >
                                    {t("custom-filter")}
                                    <i className="icon-[mdi--database-edit-outline]"></i>
                                </Button>
                            </div>
                        )}
                        <div className="flex items-center pr-2 relative">
                            <Switch.Root
                                checked={dimension === "user"}
                                onCheckedChange={() => {
                                    setDimension((v) => {
                                        return v === "category"
                                            ? "user"
                                            : "category";
                                    });
                                }}
                                className="relative z-[0] h-[29px] w-[54px] cursor-pointer rounded-sm bg-blackA6 outline-none bg-stone-300 group"
                            >
                                <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center gap-2 z-[1]">
                                    <i className="icon-[mdi--view-grid-outline] group-[data-[state=checked]]:text-white"></i>
                                    <i className="icon-[mdi--account-outline]"></i>
                                </div>
                                <Switch.Thumb className="block size-[22px] translate-x-[4px] rounded-sm bg-background transition-transform duration-100 will-change-transform data-[state=checked]:translate-x-[28px]" />
                            </Switch.Root>
                        </div>
                    </div>
                </div>
            </div>
            <FocusTypeSelector
                value={focusType}
                onValueChange={(v) => {
                    setFocusType(v);
                    setSelectedCategoryName(undefined);
                }}
                money={totalMoneys}
            />
            <div className="w-full flex-1 flex justify-center overflow-y-auto">
                <div className="w-full mx-2 max-w-[600px] flex flex-col items-center gap-4">
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
                                                categories: [
                                                    selectedCategory?.id,
                                                ],
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
                    {tagStructure.length > 0 && (
                        <div className="rounded-md border p-2 w-full flex flex-col">
                            <h2 className="font-medium text-lg my-3 text-center">
                                {t("tag-details")}
                            </h2>
                            <div className="table w-full border-collapse">
                                <div className="table-row-group divide-y">
                                    {tagStructure.map((struct) => {
                                        const index =
                                            FocusTypes.indexOf(focusType);
                                        const money = [
                                            struct.income,
                                            struct.expense,
                                            struct.income - struct.expense,
                                        ][index];
                                        const total = totalMoneys[index];
                                        return (
                                            <TagItem
                                                key={struct.id}
                                                name={struct.name}
                                                money={money}
                                                total={total}
                                                type={focusType}
                                                onClick={() => {
                                                    seeDetails({
                                                        tags: [struct.id],
                                                    });
                                                }}
                                            ></TagItem>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    )}
                    <AnalysisCloud
                        bills={
                            focusType === "expense"
                                ? filteredExpenseBills
                                : focusType === "income"
                                  ? filteredIncomeBills
                                  : filtered
                        }
                    />
                    {analysis && (
                        <div className="rounded-md border p-2 w-full flex flex-col">
                            <h2 className="font-medium text-lg my-3 text-center">
                                {t("analysis")}
                            </h2>
                            <AnalysisDetail
                                analysis={analysis}
                                type={focusType}
                                unit={analysisUnit}
                            />
                        </div>
                    )}
                    <div className="w-full flex flex-col gap-4">
                        {dataSources.highestExpenseBill && (
                            <div className="rounded-md border p-2">
                                {t("highest-expense")}:
                                <BillItem
                                    className="w-full"
                                    bill={dataSources.highestExpenseBill}
                                    showTime
                                    onClick={() =>
                                        showBillInfo(
                                            dataSources.highestExpenseBill!,
                                        )
                                    }
                                />
                            </div>
                        )}
                        {dataSources.highestIncomeBill && (
                            <div className="rounded-md border p-2">
                                {t("highest-income")}:
                                <BillItem
                                    className="w-full"
                                    bill={dataSources.highestIncomeBill}
                                    showTime
                                    onClick={() =>
                                        showBillInfo(
                                            dataSources.highestIncomeBill!,
                                        )
                                    }
                                />
                            </div>
                        )}
                    </div>
                    <div>
                        <Button variant="ghost" onClick={() => seeDetails()}>
                            {t("see-all-ledgers")}
                            <i className="icon-[mdi--arrow-up-right]"></i>
                        </Button>
                    </div>
                    <div className="w-full h-20 flex-shrink-0"></div>
                </div>
            </div>
            <BillFilterProvider />
        </div>
    );
}
