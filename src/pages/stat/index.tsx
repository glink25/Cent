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
import { DatePicker } from "@/components/date-picker";
import BillItem from "@/components/ledger/item";
import { showSortableList } from "@/components/sortable";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCustomFilters } from "@/hooks/use-custom-filters";
import { useTag } from "@/hooks/use-tag";
import { amountToNumber } from "@/ledger/bill";
import type { BillFilter } from "@/ledger/type";
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

const FocusTypes = ["income", "expense", "balance"] as const;
type FocusType = (typeof FocusTypes)[number];

function FocusTypeSelector({
    value: focusType,
    onValueChange: setFocusType,
    money,
}: {
    value: FocusType;
    onValueChange: (v: FocusType) => void;
    money: number[];
}) {
    const t = useIntl();
    const btnClass = `w-[90px] text-sm py-1 flex items-center justify-center  cursor-pointer transition-all duration-200`;
    return (
        <div className="flex items-center rounded-md shadow border border-input overflow-hidden divide-x">
            <button
                type="button"
                className={cn(
                    btnClass,
                    focusType === "income" && "!bg-stone-700 !text-white",
                )}
                onClick={() => {
                    setFocusType("income");
                }}
            >
                <div className="flex flex-col items-center justify-center">
                    {t("income")}
                    <span className="text-[10px] opacity-60">+{money[0]}</span>
                </div>
            </button>
            <button
                type="button"
                className={cn(
                    btnClass,
                    focusType === "expense" && "!bg-stone-700 !text-white",
                )}
                onClick={() => setFocusType("expense")}
            >
                <div className="flex flex-col items-center justify-center">
                    {t("expense")}
                    <span className="text-[10px] opacity-60">-{money[1]}</span>
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
                    {t("Balance")}
                    <span className="text-[10px] opacity-60">{money[2]}</span>
                </div>
            </button>
        </div>
    );
}

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

    const [filtered, setFiltered] = useState<typeof bills>([]);

    const [customEnd, setCustomEnd] = useState<number | undefined>(undefined);
    const [customStart, setCustomStart] = useState<number | undefined>(
        undefined,
    );

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
        <div className="w-full h-full p-2 flex flex-col items-center justify-center gap-4 overflow-hidden">
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
                                {/* <Button variant="outline" size="sm">
                                    <DatePicker
                                        value={customStart}
                                        onChange={setCustomStart}
                                        displayFormatter={"YYYY/MM/DD"}
                                    ></DatePicker>
                                </Button>
                                <div>-</div>
                                <Button variant="outline" size="sm">
                                    <DatePicker
                                        value={customEnd}
                                        onChange={setCustomEnd}
                                        displayFormatter={"YYYY/MM/DD"}
                                    ></DatePicker>
                                </Button> */}
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

function TagItem({
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
                        {(percent * 100).toFixed(2)}%
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
                        {money}
                    </div>
                    <i className="icon-[mdi--arrow-up-right]"></i>
                </div>
            </div>
        </div>
    );
}

function AnalysisDetail({
    analysis,
    type,
    unit,
}: {
    analysis: AnalysisResult;
    type: FocusType;
    unit?: "week" | "month" | "year" | "day";
}) {
    const t = useIntl();

    // 1. 准备所有需要格式化和插入到文案中的动态值
    const formattedValues = {
        dayAvg: (
            <span data-state="value" data-type="day">
                {amountToNumber(analysis.current.dayAvg).toFixed(2)}
            </span>
        ),
        weekAvg: (
            <span data-state="value" data-type="week">
                {amountToNumber(analysis.current.weekAvg).toFixed(2)}
            </span>
        ),
        monthAvg: (
            <span data-state="value" data-type="month">
                {amountToNumber(analysis.current.monthAvg).toFixed(2)}
            </span>
        ),
        yearAvg: (
            <span data-state="value" data-type="year">
                {amountToNumber(analysis.current.yearAvg).toFixed(2)}
            </span>
        ),
        projectedTotal: (
            <span data-state="value" data-type="predict">
                {amountToNumber(analysis.projected.total).toFixed(2)}
            </span>
        ),
    };

    // 2. 将对比文案也变成一个独立的、可翻译的部分
    const previousChange =
        analysis.previous.total === 0
            ? 0
            : (analysis.current.total - analysis.previous.total) /
              analysis.previous.total;
    const lastYearChange =
        analysis.lastYear.total === 0
            ? 0
            : (analysis.current.total - analysis.lastYear.total) /
              analysis.lastYear.total;

    // 辅助函数，用于获取增长/减少的文案片段
    const getGrowthMessage = (changeValue: number) => {
        const percentage = (Math.abs(changeValue) * 100).toFixed(2);
        // 根据数值正负选择不同的翻译ID
        const messageId =
            changeValue >= 0
                ? "analysis.growth.positive"
                : "analysis.growth.negative";
        // 使用 intl.formatMessage 生成文案片段
        return (
            <span
                className={changeValue >= 0 ? "text-red-700" : "text-green-700"}
            >
                {t(messageId, { p: percentage })}
            </span>
        );
    };

    // 3. 将对比部分的完整句子也抽象成一个翻译ID
    // 当 unit 为 'day' 时，可能没有“上一周期”的概念，可以不显示
    const ComparisonSection =
        unit !== "day" ? (
            <div className="compare text-xs">
                {t("analysis.comparison.full", {
                    // `lastPeriod` 也从语言包获取
                    lastPeriod: t(`period.${unit}`),
                    // 将生成的文案片段作为值传入
                    changeSinceLastPeriod: getGrowthMessage(previousChange),
                    changeSinceLastYear: getGrowthMessage(lastYearChange),
                })}
            </div>
        ) : null;
    return (
        <>
            <div
                className={cn(
                    "common text-sm [&_[data-state=value]]:font-medium pb-2",
                    type === "expense"
                        ? "[&_[data-state=value]]:text-green-700"
                        : type === "income"
                          ? "[&_[data-state=value]]:text-red-700"
                          : "",
                )}
            >
                {t(`analysis.summary.${type}.${unit}`, formattedValues)}
            </div>
            {ComparisonSection}
        </>
    );
}
