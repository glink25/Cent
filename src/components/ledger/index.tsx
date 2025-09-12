import { useVirtualizer } from "@tanstack/react-virtual";
import dayjs, { type Dayjs } from "dayjs";
import { useRef } from "react";
import type { OutputType } from "@/gitray";
import type { Bill } from "@/ledger/type";
import { denseTime } from "@/utils/time";
import { showBillInfo } from "../bill-info";
import BillItem from "./item";

function Divider({ date: day }: { date: Dayjs }) {
	return <div className="pl-12 pr-4 pt-4 pb-2 text-sm">{denseTime(day)}</div>;
}

export default function Ledger({
	bills,
	enableDivideAsOrdered,
	className,
}: {
	bills: OutputType<Bill>[];
	/** 如果传入的列表已按时间降序，则尝试按照日期分隔 */
	enableDivideAsOrdered?: boolean;
	className?: string;
}) {
	const parentRef = useRef<HTMLDivElement>(null);

	const rowVirtualizer = useVirtualizer({
		count: bills.length,
		getScrollElement: () => parentRef.current,
		// 使用一个合理的预估高度，这个值可以帮助虚拟化器在初次渲染时计算总高度
		// 它不必须非常精确，但越接近实际平均值，用户体验越好
		estimateSize: () => 60, // 假设一个合理的平均高度
		overscan: 5,
	});

	return (
		<div
			ref={parentRef}
			className={className}
			style={{
				height: `100%`,
				overflow: "auto",
			}}
		>
			<div
				style={{
					height: `${rowVirtualizer.getTotalSize()}px`,
					width: "100%",
					position: "relative",
				}}
			>
				{rowVirtualizer.getVirtualItems().map((virtualRow) => {
					const bill = bills[virtualRow.index];
					const curDate = dayjs.unix(bill.time / 1000);
					const isDivider = !enableDivideAsOrdered
						? undefined
						: (() => {
							const lastBill = bills[virtualRow.index + 1];
							if (!lastBill) {
								return undefined;
							}
							const lastDate = dayjs.unix(lastBill.time / 1000);
							const isSameDay = lastDate.isSame(curDate, "days");
							if (!isSameDay) {
								return lastDate;
							}
						})();
					return (
						<div
							key={virtualRow.key}
							data-index={virtualRow.index}
							// 这一行非常关键：将 ref={rowVirtualizer.measureElement}
							// 传递给每个虚拟行的 DOM 元素
							ref={rowVirtualizer.measureElement}
							style={{
								position: "absolute",
								top: 0,
								left: 0,
								width: "100%",
								// 注意：这里不再使用 virtualRow.size，而是让虚拟化器自行计算
								transform: `translateY(${virtualRow.start}px)`,
							}}
						>
							{virtualRow.index === 0 && (
								<Divider date={curDate} />
							)}
							<BillItem bill={bill} onClick={() => showBillInfo(bill)} />
							{isDivider && <Divider date={isDivider} />}
						</div>
					);
				})}
			</div>
		</div>
	);
}
