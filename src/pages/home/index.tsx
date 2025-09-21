import Ledger from "@/components/ledger";
import Loading from "@/components/loading";
import { useLedgerStore } from "@/store/ledger";
import { cn } from "@/utils";

export default function Page() {
	const { bills, loading, sync } = useLedgerStore();
	const syncIcon =
		sync === "wait"
			? "icon-[mdi--cloud-minus-outline]"
			: sync === "syncing"
				? "icon-[line-md--cloud-alt-print-loop]"
				: sync === "success"
					? "icon-[mdi--cloud-check-outline]"
					: "icon-[mdi--cloud-remove-outline]";
	return (
		<div className="w-full h-full p-2 flex flex-col overflow-hidden">
			<div className="flex flex-wrap">
				<div className="bg-stone-800 h-20 w-full rounded-lg m-1 sm:flex-1 p-2"></div>
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
