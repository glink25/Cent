import { useMemo, useState } from "react";
import { StorageDeferredAPI } from "@/api/storage";
import form from "@/components/bill-editor/form";
import Chart from "@/components/chart";
import type { Bill } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { createChartOption } from "@/utils/statistic";

export default function Page() {
	const { bills } = useLedgerStore()
	const chart1 = useMemo(() => {
		return createChartOption(bills, { chartType: 'line', timeRange: [Date.parse('2025-01-01'), Infinity] })
	}, [bills])
	return <div className="w-full h-full p-2 flex justify-center overflow-hidden">
		<div className="h-full w-full mx-2 max-w-[600px] flex flex-col">
			<div className="w-full h-[300px]">
				<Chart option={chart1} className="w-full h-full" />
			</div>
		</div>
	</div>;
}
