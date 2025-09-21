import dayjs from "dayjs";
import { useMemo } from "react";
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

export default function Page() {
	const { bills, loading, sync } = useLedgerStore();
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
		return todayBills.reduce((p, c) => {
			return p + amountToNumber(c.amount) * (c.type === "income" ? 1 : -1);
		}, 0);
	}, [todayBills]);

	const { budgets } = useBudget();
	return (
		<div className="w-full h-full p-2 flex flex-col overflow-hidden">
			<div className="flex flex-wrap flex-col w-full gap-2">
				<div className="bg-stone-800 text-background relative h-20 w-full flex justify-end rounded-lg sm:flex-1 p-4">
					<span className="absolute top-2 left-4">{t("Today")}</span>
					<AnimatedNumber value={todayAmount} className="font-bold text-4xl " />
				</div>
				<div className="w-full">
					{budgets.map((budget) => {
						return <BudgetCard key={budget.id} budget={budget} bills={bills} />;
					})}
				</div>
			</div>
			<div className="flex justify-between items-cente pl-7 pr-5 py-2">
				<div>{loading && <Loading />}</div>
				{<i className={cn(syncIcon)} />}
			</div>
			<div className="flex-1 translate-0 pb-[10px] overflow-hidden">
				<div className="w-full h-full">
					<Ledger
						bills={bills}
						className={cn(bills.length > 0 && "relative")}
						enableDivideAsOrdered
					/>
				</div>
			</div>
		</div>
	);
}
