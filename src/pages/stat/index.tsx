import dayjs from "dayjs";
import { Switch } from "radix-ui";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useShallow } from "zustand/shallow";
import { StorageDeferredAPI } from "@/api/storage";
import type { AnalysisResult } from "@/api/storage/analysis";
import {
    BillFilterViewProvider,
    showBillFilterView,
} from "@/components/bill-filter";
import { showBillInfo } from "@/components/bill-info";
import BillItem from "@/components/ledger/item";
import { AnalysisCloud } from "@/components/stat/analysic-cloud";
import { AnalysisDetail } from "@/components/stat/analysis-detail";
import { useChartPart } from "@/components/stat/chart-part";
import { DateSliced, useDateSliced } from "@/components/stat/date-slice";
import {
    type FocusType,
    FocusTypeSelector,
    FocusTypes,
} from "@/components/stat/focus-type";
import { TagItem } from "@/components/stat/tag-item";
import { Button } from "@/components/ui/button";
import { useCustomFilters } from "@/hooks/use-custom-filters";
import { useTag } from "@/hooks/use-tag";
import type { BillFilter } from "@/ledger/extra-type";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils";

export default function Page() {
    const t = useIntl();
    const { id } = useParams();

    const { bills } = useLedgerStore();
    const endTime = useMemo(() => Date.now(), []); //bills[0]?.time ?? dayjs();
    const startTime = bills[bills.length - 1]?.time ?? dayjs();

    const customFilters = useLedgerStore(
        useShallow((state) => state.infos?.meta.customFilters),
    );

    const allFilterViews = useMemo(() => {
        if (customFilters?.some((f) => f.id === "default-filter")) {
            return customFilters;
        }
        return [
            {
                id: "default-filter",
                filter: {} as BillFilter,
                name: t("default-filter-name"),
            },
            ...(customFilters ?? []),
        ];
    }, [t, customFilters]);

    const [filterViewId, setFilterViewId] = useState(
        id ?? allFilterViews[0].id,
    );

    const selectedFilterView = allFilterViews.find(
        (v) => v.id === filterViewId,
    );
    const selectedFilter = selectedFilterView?.filter;
    const fullRange = [
        selectedFilter?.start ?? startTime,
        selectedFilter?.end ?? endTime,
    ] as [number, number];
    const {
        sliceRange,
        viewType: selectedViewId,
        props: dateSlicedProps,
        setSliceId,
    } = useDateSliced({
        range: fullRange,
        selectCustomSliceWhenInitial: Boolean(id),
    });
    const realRange = [
        sliceRange?.[0] ?? startTime,
        sliceRange?.[1] ?? endTime,
    ];

    const navigate = useNavigate();
    const seeDetails = (append?: Partial<BillFilter>) => {
        navigate("/search", {
            state: {
                filter: {
                    ...selectedFilter,
                    start: realRange[0],
                    end: realRange[1],
                    ...append,
                },
            },
        });
    };

    const [filtered, setFiltered] = useState<Bill[]>([]);

    useEffect(() => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        if (!selectedFilter) {
            return;
        }
        StorageDeferredAPI.filter(book, {
            ...selectedFilter,
            start: realRange[0],
            end: realRange[1],
        }).then((result) => {
            setFiltered(result);
        });
    }, [selectedFilter, realRange[0], realRange[1]]);

    const [focusType, setFocusType] = useState<FocusType>("expense");
    const [dimension, setDimension] = useState<"category" | "user">("category");

    const { dataSources, Part, setSelectedCategoryName } = useChartPart({
        selectedViewId,
        seeDetails,
        focusType,
        filtered,
        dimension,
    });

    const totalMoneys = FocusTypes.map((t) => dataSources.total[t]);

    const { tags } = useTag();
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
        if (!book || !realRange[0] || !realRange[1]) {
            setAnalysis(undefined);
            return;
        }
        if (!analysisUnit) {
            setAnalysis(undefined);
            return;
        }
        StorageDeferredAPI.analysis(
            book,
            [realRange[0], realRange[1]],
            analysisUnit,
            focusType,
        ).then((v) => {
            setAnalysis(v);
        });
    }, [analysisUnit, focusType, realRange[0], realRange[1]]);

    const { updateFilter } = useCustomFilters();
    const toChangeFilter =
        filterViewId === "default-filter"
            ? undefined
            : async () => {
                  console.log(selectedFilterView, "sss");
                  if (!selectedFilterView) {
                      return;
                  }
                  const id = selectedFilterView.id;
                  console.log(selectedFilterView, "ssssdsd");
                  const action = await showBillFilterView({
                      filter: selectedFilterView.filter,
                      name: selectedFilterView.name,
                  });
                  if (action === "delete") {
                      await updateFilter(id);
                      setFilterViewId(allFilterViews[0].id);
                      return;
                  }
                  await updateFilter(id, {
                      filter: action.filter,
                      name: action.name,
                  });
              };
    return (
        <div className="w-full h-full p-2 flex flex-col items-center justify-center gap-4 overflow-hidden page-show">
            <div className="w-full mx-2 max-w-[600px] flex flex-col gap-2">
                <div className="w-full flex flex-col gap-2">
                    <div className="w-full flex">
                        <div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden">
                            {allFilterViews.map((filter) => (
                                <Button
                                    key={filter.id}
                                    size={"sm"}
                                    className={cn(
                                        filterViewId !== filter.id
                                            ? "text-primary/50"
                                            : "relative after:absolute after:bottom-0 after:left-0 after:w-full after:h-[2px] after:rounded-full after:bg-primary/20",
                                    )}
                                    variant="ghost"
                                    onClick={() => {
                                        setSliceId(undefined);
                                        setFilterViewId(filter.id);
                                    }}
                                >
                                    {filter.name}
                                </Button>
                            ))}
                        </div>
                    </div>
                </div>
                <DateSliced
                    {...dateSlicedProps}
                    onClickSettings={toChangeFilter}
                >
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
                </DateSliced>
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
                    {Part}
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
            <BillFilterViewProvider />
        </div>
    );
}
