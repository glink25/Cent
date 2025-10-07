import dayjs from "dayjs";
import { useMemo, useRef } from "react";
import AnimatedNumber from "@/components/animated-number";
import BudgetCard from "@/components/budget/card";
import Ledger from "@/components/ledger";
import Loading from "@/components/loading";
import { useBudget } from "@/hooks/use-budget";
import { amountToNumber } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils";
import { filterOrderedBillListByTimeRange } from "@/utils/filter";
import { useBookStore } from "@/store/book";
import { StorageAPI, toBookName } from "@/api/storage";
import { useSnap } from "@/hooks/use-snap";
import { PaginationIndicator } from "@/components/indicator";

export default function Page() {
	const { bills, loading, sync } = useLedgerStore();
	const { currentBookId } = useBookStore();
	const t = useIntl();
	const syncIcon =
		sync === "wait"
			? "icon-[mdi--cloud-minus-outline]"
			: sync === "syncing"
				? "icon-[line-md--cloud-alt-print-loop]"
				: sync === "success"
					? "icon-[mdi--cloud-check-outline]"
					: "icon-[mdi--cloud-remove-outline]";

	const todayBills = useMemo(() => {
		const now = dayjs();
		const today = filterOrderedBillListByTimeRange(bills, [
			now.startOf("day"),
			now.endOf("day"),
		]);
		return today;
	}, [bills]);

	const todayAmount = useMemo(() => {
		return amountToNumber(
			todayBills.reduce((p, c) => {
				return p + c.amount * (c.type === "income" ? 1 : -1);
			}, 0),
		);
	}, [todayBills]);

	const { budgets } = useBudget();

	const budgetContainer = useRef<HTMLDivElement>(null);
	const { count: budgetCount, index: curBudgetIndex } = useSnap(
		budgetContainer,
		0,
	);
	return (
		<div className="w-full h-full p-2 flex flex-col overflow-hidden">
			<div className="flex flex-wrap flex-col w-full gap-2">
				<div className="bg-stone-800 text-background relative h-20 w-full flex justify-end rounded-lg sm:flex-1 p-4">
					<span className="absolute top-2 left-4">{t("Today")}</span>
					<AnimatedNumber value={todayAmount} className="font-bold text-4xl " />
					{currentBookId && (
						<button
							type="button"
							className="absolute bottom-2 left-4 text-xs opacity-60 flex items-center gap-1 cursor-pointer"
							onClick={() => {
								useBookStore.setState((prev) => ({ ...prev, visible: true }));
							}}
						>
							<i className="icon-[mdi--book]"></i>
							{toBookName(currentBookId)}
						</button>
					)}
				</div>
				<div className="w-full flex flex-col gap-1">
					<div
						ref={budgetContainer}
						className="w-full flex overflow-x-auto gap-2 scrollbar-hidden snap-mandatory snap-x"
					>
						{budgets.map((budget) => {
							return (
								<BudgetCard
									className="flex-shrink-0 snap-start h-fit"
									key={budget.id}
									budget={budget}
									bills={bills}
								/>
							);
						})}
					</div>
					<PaginationIndicator count={budgetCount} current={curBudgetIndex} />
				</div>
			</div>
			<button
				type="button"
				className="flex justify-between items-center pl-7 pr-5 py-2 cursor-pointer"
				onClick={() => {
					StorageAPI.toSync();
				}}
			>
				<div>{loading && <Loading />}</div>
				{<i className={cn(syncIcon)} />}
			</button>
			<div className="flex-1 translate-0 pb-[10px] overflow-hidden">
				<div className="w-full h-full">
					{bills.length > 0 ? (
						<Ledger
							bills={bills}
							className={cn(bills.length > 0 && "relative")}
							enableDivideAsOrdered
						/>
					) : (
						<div className="text-xs p-4 text-center">
							{t("nothing-here-add-one-bill")}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
