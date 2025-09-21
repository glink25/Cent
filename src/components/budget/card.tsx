import dayjs from "dayjs";
import { Collapsible } from "radix-ui";
import { useMemo } from "react";
import useCategory from "@/hooks/use-category";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import type { Budget } from "./type";
import { budgetEncountered, budgetRange, budgetTotal } from "./util";

export default function BudgetCard({
	className,
	budget,
	bills,
}: {
	className?: string;
	budget: Budget;
	bills: Bill[];
}) {
	const t = useIntl();
	const total = useMemo(() => budgetTotal(budget), [budget]);
	const [allRanges, currentRange] = useMemo(
		() => budgetRange(budget),
		[budget],
	);
	const encountered = useMemo(
		() =>
			currentRange ? budgetEncountered(budget, bills, currentRange) : undefined,
		[budget, bills, currentRange],
	);

	const todayEncountered = useMemo(
		() =>
			currentRange
				? budgetEncountered(budget, bills, [
						dayjs().startOf("day"),
						dayjs().endOf("day"),
					])
				: undefined,
		[budget, bills, currentRange],
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

	const { categories } = useCategory();
	if (!encountered) {
		return <div>Budget Finished</div>;
	}
	return (
		<div
			className={cn(
				"rounded-lg border flex flex-col w-full px-4 py-2",
				className,
			)}
		>
			<Collapsible.Root className="group">
				<div className="w-full flex items-center justify-between">
					<div className="font-semibold">{budget.title}</div>
					<div className="text-sm">
						{todayEncountered && time && (
							<>
								今日可用:
								{(total / time.totalDays - todayEncountered.totalUsed).toFixed(
									2,
								)}
							</>
						)}
					</div>
				</div>
				<div className="flex flex-col">
					<BudgetBar
						total={total}
						used={encountered.totalUsed}
						todayUsed={todayEncountered?.totalUsed}
						time={time}
					/>
					<div>
						<Collapsible.Trigger className="h-4 flex justify-end w-full group">
							<i className=" group-[[data-state=open]]:icon-[mdi--chevron-down] group-[[data-state=closed]]:icon-[mdi--chevron-up]" />
						</Collapsible.Trigger>
					</div>
					<Collapsible.Content className="data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
						{encountered?.categoriesUsed?.map((v) => {
							const category = categories.find((c) => c.id === v.id)!;
							const cb = budget.categoriesBudget!.find((c) => c.id === v.id)!;
							const td = todayEncountered!.categoriesUsed!.find(
								(c) => c.id === v.id,
							)!;
							return (
								<div key={v.id}>
									{t(category?.name)}
									<BudgetBar
										total={cb.budget}
										used={v.used}
										todayUsed={td.used}
										time={time}
									/>
								</div>
							);
						})}
					</Collapsible.Content>
				</div>
			</Collapsible.Root>
		</div>
	);
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
					className="inner h-2 rounded-full bg-green-600 absolute left-0 top-0"
					style={{
						width: `${p * 100}%`,
					}}
				></div>
			</div>
			<div
				className="absolute top-0 h-4 bg-slate-500 w-[2px]"
				style={{
					left: `${timePercent * 100}%`,
				}}
			></div>
		</div>
	);
}

function BudgetBar({
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
					<div>已支出:{used.toFixed(2)}</div>
					{todayUsed !== undefined && <div>今日支出:{todayUsed}</div>}
					{time && (
						<div>
							日均支出:{(used / (time.totalDays - time?.leftDays)).toFixed(2)}
						</div>
					)}
				</div>
				<div className="text-end">
					<div>总预算: {total}</div>
					<div>总剩余: {(total - used).toFixed(2)}</div>
					{time && (
						<>
							日均剩余预算:
							{((total - used) / time.leftDays).toFixed(2)}
						</>
					)}
				</div>
			</div>
		</>
	);
}
