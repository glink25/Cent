import dayjs, { type Dayjs } from "dayjs";
import { merge } from "lodash-es";
import { Switch } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useShallow } from "zustand/shallow";
import { StorageDeferredAPI } from "@/api/storage";
import { BillFilterProvider, showBillFilter } from "@/components/bill-filter";
import Chart, { type ChartInstance, type ECOption } from "@/components/chart";
import { DatePicker } from "@/components/date-picker";
import BillItem from "@/components/ledger/item";
import { Button } from "@/components/ui/button";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCustomFilters } from "@/hooks/use-custom-filters";
import type { BillFilter } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils";
import { processBillDataForCharts } from "@/utils/charts";
import { showSortableList } from "@/components/sortable";

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

const overallTrendOption = (dataset: { source: any[] }, options?: ECOption) =>
	merge(
		{
			// 提示框，'axis' 表示鼠标悬浮在x轴上时触发
			tooltip: {
				trigger: "axis",
			},
			// 图例，用于筛选系列
			legend: {
				// ECharts 会自动从 dataset.source 的第一行读取图例名称
				// ['date', '收入', '支出', '结余'] -> '收入', '支出', '结余'
			},
			// ECharts 的数据核心
			dataset: dataset,
			// x轴配置，type: 'category' 表示类目轴
			// ECharts 会自动将 dataset 的第一列 ('date') 映射到 x 轴
			xAxis: {
				type: "category",
				boundaryGap: false, // 折线图建议设为 false，让线贴近y轴
			},
			// y轴配置，type: 'value' 表示数值轴
			yAxis: {
				type: "value",
			},
			// 系列列表，定义了图表中的每一条线（或其他图形）
			series: [
				// ECharts 会自动将 dataset 的第二列('收入')映射到第一个系列
				{ type: "line", smooth: true },
				// 第三列('支出')映射到第二个系列
				{ type: "line", smooth: true },
				// 第四列('结余')映射到第三个系列
				{ type: "line", smooth: true },
			],
		},
		options,
	);

/**
 * 通用的趋势图 ECharts Option 生成器
 * @param title - 图表标题
 * @param dataset - 包含 source 的数据集
 * @param options - 自定义配置
 * @returns ECharts Option
 */
const userTrendOption = (
	dataset: { source: (string | number)[][] },
	options?: ECOption,
): ECOption => {
	const seriesCount = dataset.source[0].length - 1;

	const baseOption: ECOption = {
		tooltip: { trigger: "axis" },
		legend: {},
		dataset: dataset,
		xAxis: { type: "category", boundaryGap: false },
		yAxis: { type: "value" },
		series: Array.from({ length: seriesCount }, (_, i) => ({
			type: "line",
			smooth: true,
			name: dataset.source[0][i + 1], // 系列名称，用于图例和 tooltip
			encode: {
				x: "date", // 映射到 dataset 中的 'date' 列
				y: dataset.source[0][i + 1], // 映射到 dataset 中的 'glink25' 列
			},
		})),
	};

	return merge(baseOption, options);
};

const structureOption = (dataset: any[], options?: ECOption) =>
	merge(
		{
			title: {
				text: "支出结构",
				left: "center", // 标题居中
			},
			// 提示框，'item' 表示鼠标悬浮在数据项（扇区）上时触发
			tooltip: {
				trigger: "item",
				// 格式化提示内容：a(系列名), b(数据项名), c(数值), d(百分比)
				formatter: "{b}: {c} ({d}%)",
			},
			legend: {
				orient: "vertical", // 图例垂直排列
				left: "left", // 靠左放置
			},
			series: [
				{
					name: "支出类型", // 系列名称，会在 tooltip 中显示
					type: "pie",
					center: ["55%", "50%"],
					radius: "55%", // 饼图半径
					labelLine: {
						show: true,
						length: 10, // 第一段（直线段）长度 20px 或 20（单位取决于版本 / 语法上下文）
						length2: 10, // 第二段（拐弯 / 水平延伸）长度 30px
						lineStyle: {
							width: 1,
							type: "solid",
							color: "#aaa",
						},
						smooth: 0.2, // 可选，让折线有点圆弧过渡
					},
					// 直接使用我们生成的 { name, value } 格式的数据
					data: dataset,
					emphasis: {
						// 高亮状态下的样式
						itemStyle: {
							shadowBlur: 10,
							shadowOffsetX: 0,
							shadowColor: "rgba(0, 0, 0, 0.5)",
						},
					},
				},
			],
		},
		options,
	);

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
	const seeDetails = () => {
		navigate("/search", { state: { filter } });
	};

	const { categories } = useCategory();
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
					getMajorCategory: (id) => {
						const cate = categories.find((c) => c.id === id);
						if (!cate?.parent) {
							return cate ?? { id, name: id };
						}
						const parent = categories.find((c) => c.id === cate.parent)!;
						return parent;
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
				money={FocusTypes.map((t) => dataSources.total[t])}
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
						/>
					</div>
					<div>
						<Button variant="ghost" onClick={() => seeDetails()}>
							{t("see-all-ledgers")}
							<i className="icon-[mdi--arrow-up-right]"></i>
						</Button>
					</div>
					<div className="w-full flex flex-col gap-4">
						{dataSources.highestExpenseBill && (
							<div className="rounded-md border p-2">
								{t("highest-expense")}:
								<BillItem bill={dataSources.highestExpenseBill} showTime />
							</div>
						)}
						{dataSources.highestIncomeBill && (
							<div className="rounded-md border p-2">
								{t("highest-income")}:
								<BillItem bill={dataSources.highestIncomeBill} showTime />
							</div>
						)}
					</div>
					<div className="w-full h-20 flex-shrink-0"></div>
				</div>
			</div>
			<BillFilterProvider />
		</div>
	);
}
