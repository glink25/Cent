import type { OutputType } from "@/gitray";
import type { Bill } from "@/ledger/type";
import { showBillInfo } from "../bill-info";
import BillItem from "./item";

export default function Ledger({
	bills,
}: {
	bills: OutputType<Bill & { creatorId: string }>[];
}) {
	return (
		<div>
			{bills.map((v) => {
				return (
					<BillItem
						key={v.id}
						bill={v}
						onClick={() => showBillInfo(v)}
					></BillItem>
				);
			})}
		</div>
	);
}
