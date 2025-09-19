import dayjs, { type Dayjs } from "dayjs";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router";
import { useShallow } from "zustand/shallow";
import { StorageDeferredAPI } from "@/api/storage";
import Chart from "@/components/chart";
import { DatePicker } from "@/components/date-picker";
import { Button } from "@/components/ui/button";
import type { BillFilter } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils";
import { createChartOption } from "@/utils/chart";

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
	const { id } = useParams();
	const { bills } = useLedgerStore();
	const endTime = bills[0]?.time ?? dayjs();
	const startTime = bills[bills.length - 1]?.time ?? dayjs();
	const START = useMemo(() => dayjs.unix(startTime / 1000), [startTime]);
	const END = useMemo(() => dayjs.unix(endTime / 1000), [endTime]);

	const customFilters = useLedgerStore(
		useShallow((state) => state.infos?.globalMeta.customFilters),
	);
	const views: Views[] = useMemo(() => {
		return [
			...StaticViews,
			...(customFilters?.map((v) => ({ ...v, label: v.name })) ?? []),
		];
	}, [customFilters]);
	const [selectedViewId, setSelectedViewId] = useState(id ?? "monthly");

	const slices = useMemo(() => {
		const labels = (() => {
			if (selectedViewId === "weekly") {
				return {
					unit: "week",
					labelThis: "This Week",
					labelLast: "Last Week",
					format: "MM-DD",
					max: 4,
				} as const;
			}
			if (selectedViewId === "monthly") {
				return {
					unit: "month",
					labelThis: "This Month",
					labelLast: "Last Month",
					format: "YYYY-MM",
				} as const;
			}
			if (selectedViewId === "yearly") {
				return {
					unit: "year",
					labelThis: "This Year",
					labelLast: "Last Year",
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
	}, [selectedViewId, END, START]);

	const [selectedSlice, setSelectedSlice] = useState(slices[0]?.label);

	useEffect(() => {
		setSelectedSlice(slices[0]?.label);
	}, [slices[0]?.label]);

	const [filtered, setFiltered] = useState<typeof bills>([]);

	const [customEnd, setCustomEnd] = useState(() => dayjs().unix() * 1000);
	const [customStart, setCustomStart] = useState(
		() => dayjs().subtract(1, "month").unix() * 1000,
	);

	useEffect(() => {
		const book = useBookStore.getState().currentBookId;
		if (!book) {
			return;
		}
		const filter = (() => {
			if (selectedViewId === "custom") {
				return {
					start: customStart,
					end: customEnd,
				} as BillFilter;
			}
			if (["weekly", "monthly", "yearly"].includes(selectedViewId)) {
				const slice = slices.find((s) => s.label === selectedSlice);
				if (!slice) {
					return;
				}
				return {
					start: slice.start.unix() * 1000,
					end: slice.end.unix() * 1000,
				} as BillFilter;
			}
			return views.find((v) => v.id === selectedViewId)?.filter;
		})();
		if (!filter) {
			return;
		}
		StorageDeferredAPI.filter(book, filter).then((result) => {
			setFiltered(result);
		});
	}, [
		slices.find,
		selectedSlice,
		selectedViewId,
		customEnd,
		customStart,
		views.find,
	]);

	const chart1 = useMemo(() => {
		return createChartOption(filtered, {
			chartType: "line",
		});
	}, [filtered]);
	return (
		<div className="w-full h-full p-2 flex justify-center overflow-hidden">
			<div className="h-full w-full mx-2 max-w-[600px] flex flex-col">
				<div className="w-full flex flex-col gap-2">
					<div className="w-full flex gap-2 overflow-x-auto scrollbar-hidden">
						{views.map((view) => (
							<Button
								key={view.id}
								size={"sm"}
								className={cn(selectedViewId !== view.id && "text-primary/50")}
								variant={selectedViewId === view.id ? "default" : "ghost"}
								onClick={() => {
									setSelectedViewId(view.id);
								}}
							>
								{view.label}
							</Button>
						))}
					</div>
					{slices.length > 0 && (
						<div className="w-full flex gap-2 overflow-x-auto scrollbar-hidden">
							{slices.map((slice) => (
								<Button
									key={slice.label}
									variant="ghost"
									size="sm"
									className={cn(
										"text-primary/40",
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
					)}
					{selectedViewId === "custom" && (
						<div className="w-full flex justify-center items-center gap-3 text-xs">
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
					)}
				</div>
				<div className="w-full h-[300px]">
					<Chart option={chart1} className="w-full h-full" />
				</div>
			</div>
		</div>
	);
}
