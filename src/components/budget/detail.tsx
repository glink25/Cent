/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
import dayjs from "dayjs";
import { useCallback, useMemo, useRef, useState } from "react";
import useCategory from "@/hooks/use-category";
import { useSnap } from "@/hooks/use-snap";
import createTeleportSlot from "@/hooks/use-teleport";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils";
import { denseDate } from "@/utils/time";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import type { Budget } from "./type";
import {
	budgetEncountered,
	budgetRange,
	budgetReached,
	budgetTotal,
} from "./util";

export function useBudgetDetail(budget: Budget) {
	const total = useMemo(() => budgetTotal(budget), [budget]);
	const [allRanges, currentRange] = useMemo(
		() => budgetRange(budget),
		[budget],
	);

	const getTime = useCallback((currentRange: [dayjs.Dayjs, dayjs.Dayjs]) => {
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
	}, []);
	return {
		total,
		allRanges,
		currentRange,
		getTime,
	};
}

function BudgetProgress({
	total,
	used,
	timePercent,
	todayUsed,
}: {
	total: number;
	used: number;
	timePercent: number;
	todayUsed?: number;
}) {
	const p = used / total;
	const tp = (todayUsed ?? 0) / total;
	return (
		<div className="w-full flex items-center h-4 relative">
			<div className="relative w-full h-2 rounded-full outer bg-gray-300 flex items-center overflow-hidden">
				<div
					className="inner h-2 rounded-full bg-amber-500 absolute top-0"
					style={{
						left: `calc(${p * 100}% - 16px)`,
						width: `${tp * 100}%`,
					}}
				></div>
				<div
					className={cn(
						"inner h-2 rounded-full absolute left-0 top-0",
						p > timePercent ? "bg-red-700" : "bg-green-600",
					)}
					style={{
						width: `${p * 100}%`,
					}}
				></div>
			</div>
			<div
				className="absolute top-0 h-4 bg-slate-500 w-[2px]"
				style={{
					left: `${Math.min(timePercent, 1) * 100}%`,
				}}
			></div>
		</div>
	);
}

export function BudgetBar({
	total,
	used,
	todayUsed,
	time,
}: {
	total: number;
	used: number;
	todayUsed?: number;
	time?: { percent: number; leftDays: number; totalDays: number };
}) {
	const t = useIntl();
	return (
		<>
			<BudgetProgress
				total={total}
				used={used}
				todayUsed={todayUsed}
				timePercent={time?.percent ?? 1}
			/>
			<div className="flex justify-between items-center text-xs gap-1">
				<div className="flex flex-col">
					<div>
						{t("expensed")}:{used.toFixed(2)}
					</div>
					{todayUsed !== undefined && (
						<div>
							{t("today-expense")}:{todayUsed}
						</div>
					)}
					{time && (
						<div>
							{t("daily-expense")}:
							{(used / (time.totalDays - time?.leftDays)).toFixed(2)}
						</div>
					)}
				</div>
				<div className="text-end">
					<div>
						{t("total-budget")}: {total}
					</div>
					<div>
						{t("total-left")}: {(total - used).toFixed(2)}
					</div>
					{time && (
						<>
							{t("daily-left")}:
							{((total - used) / Math.max(1, time.leftDays)).toFixed(2)}
						</>
					)}
				</div>
			</div>
		</>
	);
}

const Portal = createTeleportSlot();

function BudgetDetail({
	budget,
	onCancel,
}: {
	budget: Budget;
	onCancel?: () => void;
	onConfirm?: (v?: any) => void;
}) {
	const t = useIntl();
	const { bills } = useLedgerStore();
	const { categories } = useCategory();
	const { currentRange, getTime, total, allRanges } = useBudgetDetail(budget);
	const initialIndex = currentRange
		? allRanges.findIndex((rs) => rs[0].isSame(currentRange[0]))
		: allRanges.length - 1;
	const [selectedIndex, setSelectedIndex] = useState(initialIndex);

	const scrollRef = useRef<HTMLDivElement>(null);
	useSnap(scrollRef, initialIndex);

	const budgetRanges = useMemo(() => {
		return allRanges.map((range, index) => {
			const latestTime = bills[0].time;

			const active = latestTime >= range[0].unix() * 1000;
			const totalReached = active
				? budgetReached(budget, bills, range)
				: undefined;

			return {
				id: index,
				range,
				reached: totalReached?.map((v) => v[1]),
				active,
				label: (
					<>
						{denseDate(range[0], ".")} - {denseDate(range[1], ".")}
					</>
				),
			};
		});
	}, [allRanges, bills, budget]);
	const reachedCount =
		budgetRanges.filter((b) => b.reached?.every((r) => r)).length - 1;

	const selectedRange = allRanges[selectedIndex];

	const encountered = useMemo(
		() =>
			selectedRange
				? budgetEncountered(budget, bills, selectedRange)
				: undefined,
		[budget, bills, selectedRange],
	);

	const time = useMemo(
		() => (selectedRange ? getTime(selectedRange) : undefined),
		[selectedRange, getTime],
	);

	const isTodayInRange = useMemo(() => {
		const today = dayjs();
		return (
			today.isSameOrAfter(selectedRange[0]) &&
			today.isSameOrBefore(selectedRange[1])
		);
	}, [selectedRange]);

	const todayEncountered = useMemo(
		() =>
			isTodayInRange && currentRange
				? budgetEncountered(budget, bills, [
						dayjs().startOf("day"),
						dayjs().endOf("day"),
					])
				: undefined,
		[isTodayInRange, currentRange, bills, budget],
	);

	return (
		<>
			<Portal.Teleport>
				<div
					className={cn(
						"text-xs flex justify-center items-center gap-1",
						reachedCount > 0 ? "text-green-700" : "opacity-60",
					)}
				>
					<i className="icon-[mdi--medal-outline]"></i>
					{reachedCount > 0
						? t("budget-reached-times", { n: reachedCount })
						: t("budget-reached-not-yet")}
				</div>
			</Portal.Teleport>
			<div
				ref={scrollRef}
				className="w-full flex gap-2 px-4 overflow-x-auto scrollbar-hidden snap-mandatory snap-x pb-2"
			>
				{budgetRanges.map(({ label, id, active, reached }, i) => (
					<Button
						variant={i === selectedIndex ? "default" : "ghost"}
						key={id}
						className="flex-shrink-0 text-sm snap-center"
						disabled={!active}
						title={
							reached
								? reached.every((r) => r)
									? t("budget-reached")
									: t("budget-unreached")
								: t("budget-not-time")
						}
						onClick={() => setSelectedIndex(i)}
					>
						<div className="flex flex-col justify-center items-center">
							{label}
							<div className="flex justify-center items-center gap-1 h-1">
								{reached?.map((r, i) => (
									<div
										key={i}
										className={`w-1 h-1 rounded-full ${
											r ? "bg-green-700" : "bg-red-700"
										}`}
									/>
								))}
							</div>
						</div>
					</Button>
				))}
				<Button variant="ghost" className="flex-shrink-0 text-sm" disabled>
					{budget.end ? "END" : <i className="icon-[mdi--infinity] size-5"></i>}
				</Button>
			</div>
			{encountered && (
				<div className="flex-1 overflow-y-auto px-4 flex flex-col gap-2 pb-6">
					<div>
						{t("total-budget")}
						<BudgetBar
							total={total}
							used={encountered.totalUsed}
							todayUsed={todayEncountered?.totalUsed}
							time={time}
						/>
					</div>
					{encountered?.categoriesUsed?.map((v) => {
						const category = categories.find((c) => c.id === v.id);
						const total =
							budget.categoriesBudget?.find((c) => c.id === v.id)?.budget ?? 0;

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
				</div>
			)}
		</>
	);
}

function BudgetDetailForm({
	edit: budget,
	onCancel,
}: {
	edit?: Budget;
	onCancel?: () => void;
	onConfirm?: (v?: any) => void;
}) {
	return (
		<Portal.Provider>
			<PopupLayout
				title={budget?.title}
				right={<Portal.Slot className="px-2" />}
				onBack={onCancel}
				className="h-full overflow-hidden"
			>
				{budget && <BudgetDetail budget={budget} />}
			</PopupLayout>
		</Portal.Provider>
	);
}

export const [BudgetDetailProvider, showBudgetDetail] = createConfirmProvider(
	BudgetDetailForm,
	{
		dialogTitle: "Budget Detail",
		contentClassName:
			"h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
	},
);
