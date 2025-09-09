import Ledger from "@/components/ledger";
import { useBills } from "@/store/ledger";

export default function Page() {
	const bills = useBills();
	console.log(bills, "bllis");
	return (
		<div className="w-full h-full p-2 flex flex-col overflow-hidden">
			<div className="flex flex-wrap">
				<div className="bg-stone-800 h-20 w-full rounded-lg m-1 sm:flex-1 p-2"></div>
			</div>
			<div className="flex-1 overflow-y-auto">
				<Ledger bills={bills} />
			</div>
		</div>
	);
}
