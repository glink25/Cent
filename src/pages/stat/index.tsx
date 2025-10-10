import dayjs, { type Dayjs } from "dayjs";
import { merge } from "lodash-es";
import { Switch } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useShallow } from "zustand/shallow";
import { StorageDeferredAPI } from "@/api/storage";
import { BillFilterProvider, showBillFilter } from "@/components/bill-filter";
import { showBillInfo } from "@/components/bill-info";
import Chart, { type ChartInstance, type ECOption } from "@/components/chart";
import { DatePicker } from "@/components/date-picker";
import BillItem from "@/components/ledger/item";
import { showSortableList } from "@/components/sortable";
import { Button } from "@/components/ui/button";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCustomFilters } from "@/hooks/use-custom-filters";
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
import { useTag } from "@/hooks/use-tag";
import type { ECElementEvent } from "echarts/core";

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
				onClick={() => setFocusType("income")}
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

function TagItem({
	name,
	money,
	total,
}: {
	name: string;
	money: number;
	total: number;
}) {
	return (
		<div className="flex w-full items-center gap-2">
			<div className="text-sm">#{name}</div>
			<div className="flex-1">
				{money} - {total}
			</div>
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

	const [customEnd, setCustomEnd] = useState(() => dayjs().unix() * 1000);
	const [customStart, setCustomStart] = useState(
		() => dayjs().subtract(1, "month").unix() * 1000,
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
	const [focusType, _setFocusType] = useState<FocusType>("expense");
	const setFocusType: typeof _setFocusType = useCallback((v) => {
		_setFocusType((prev) => {
			const newV = typeof v === "function" ? v(prev) : v;
			const opt = trendChart.current?.getOption();
			const legend = (opt?.dataset as any)?.[0]?.source?.[0]?.slice(1);
			if (!legend?.length) {
				return newV;
			}
			const selectLegendIndex = FocusTypes.indexOf(newV);
			const unselectLegendIndexes = FocusTypes.map((value, index) => ({
				value,
				index,
			}))
				.filter((v) => v.index !== selectLegendIndex)
				.map((v) => v.index);
			trendChart.current?.dispatchAction({
				type: "legendSelect",
				name: legend[selectLegendIndex],
			});
			unselectLegendIndexes.forEach((i) => {
				trendChart.current?.dispatchAction({
					type: "legendUnSelect",
					name: legend[i],
				});
			});

			return newV;
		});
	}, []);

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
						const parent = categories.find((c) => c.id === cate.parent)!;
						return { ...cate, parent };
					},
					getUserInfo: (id) => {
						return {
							id,
							name: creators.find((u) => `${u.id}` === id)?.name ?? `${id}`,
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
			return [
				overallTrendOption(dataSources.overallTrend, {
					title: {
						text: t("overall-trend"),
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

	const [selectedCategoryName, setSelectedCategoryName] = useState<string>();

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
		return structureOption(data, { title: { text: selectedCategory.name } });
	}, [dimension, dataSources.subCategoryStructure, selectedCategory]);

	const tagStructure = useMemo(
		() =>
			Array.from(dataSources.tagStructure.entries()).map(([tagId, struct]) => {
				const tag = tags.find((t) => t.id === tagId);
				return {
					...tag!,
					...struct,
				};
			}),
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
										selectedViewId !== view.id && "text-primary/50",
									)}
									variant={selectedViewId === view.id ? "default" : "ghost"}
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
					<div className="flex gap-2 items-center">
						{slices.length > 0 ? (
							<div className="flex-1 flex gap-2 overflow-x-auto scrollbar-hidden">
								{slices.map((slice) => (
									<Button
										key={slice.label}
										variant="ghost"
										size="sm"
										className={cn(
											"text-primary/40 px-2",
											selectedSlice === slice.label && "text-primary",
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
								<Button variant="outline" size="sm">
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
								</Button>
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
										return v === "category" ? "user" : "category";
									});
								}}
								className="relative z-[0] h-[29px] w-[54px] cursor-default rounded-sm bg-blackA6 outline-none bg-stone-300 group"
							>
								<div className="absolute top-0 left-0 w-full h-full flex items-center justify-center gap-2 z-[1]">
									<i className="icon-[mdi--category-outline] group-[data-[state=checked]]:text-white"></i>
									<i className="icon-[mdi--account-outline]"></i>
								</div>
								<Switch.Thumb className="block size-[22px] translate-x-[4px] rounded-sm bg-white  transition-transform duration-100 will-change-transform data-[state=checked]:translate-x-[28px]" />
							</Switch.Root>
						</div>
					</div>
				</div>
			</div>
			<FocusTypeSelector
				value={focusType}
				onValueChange={setFocusType}
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
					<div className="flex-shrink-0 w-full h-[300px]">
						<Chart
							key={dimension}
							option={charts[1]}
							className="w-full h-full border rounded-md"
							onClick={onStructureChartClick}
						/>
					</div>
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
											seeDetails({ categories: [selectedCategory?.id] });
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
						<div className="rounded-md border p-2 w-full">
							{tagStructure.map((struct) => {
								const index = FocusTypes.indexOf(focusType);
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
									></TagItem>
								);
							})}
						</div>
					)}
					<div className="w-full flex flex-col gap-4">
						{dataSources.highestExpenseBill && (
							<div className="rounded-md border p-2">
								{t("highest-expense")}:
								<BillItem
									bill={dataSources.highestExpenseBill}
									showTime
									onClick={() => showBillInfo(dataSources.highestExpenseBill!)}
								/>
							</div>
						)}
						{dataSources.highestIncomeBill && (
							<div className="rounded-md border p-2">
								{t("highest-income")}:
								<BillItem
									bill={dataSources.highestIncomeBill}
									showTime
									onClick={() => showBillInfo(dataSources.highestIncomeBill!)}
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
