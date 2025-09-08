import React, { useMemo } from "react";
import { amountToNumber } from "@/ledger/bill";
import { getCategoryById } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import { cn } from "@/utils";

interface BillItemProps {
	bill: Bill & { creatorId: string };
	onClick?: () => void;
	className?: string;
}

export default function BillItem({ bill, className, onClick }: BillItemProps) {
	const category = useMemo(
		() => getCategoryById(bill.categoryId),
		[bill.categoryId],
	);
	const creator = useMemo(
		() => ({ me: true, name: `${bill.creatorId}` }),
		[bill.creatorId],
	);

	return (
		<button
			type="button"
			className={cn(
				"bill-item w-full flex justify-between items-center px-4 py-4 buttoned cursor-pointer",
				className,
			)}
			onClick={onClick}
		>
			{/* 左侧图标 + 信息 */}
			<div className="flex items-center overflow-hidden">
				<div className="rounded-full bg-white border w-10 h-10 flex items-center justify-center">
					<i className={category?.icon}></i>
				</div>
				<div className="flex-1 flex flex-col px-4 overflow-hidden">
					<div className="flex text-md font-semibold">
						<div>{category ? category.name : ""}</div>
					</div>
					<div className="flex text-xs">
						<div>{creator?.me ? "me" : (creator?.name ?? "unknown-user")}</div>
						{bill.comment && (
							<>
								<div className="px-1">|</div>
								<div className="truncate">{bill.comment}</div>
							</>
						)}
					</div>
				</div>
			</div>

			{/* 金额 */}
			<div
				className={`text-lg font-bold truncate flex-shrink-0 text-right ${
					bill.type === "expense"
						? "text-red-700"
						: bill.type === "income"
							? "text-green-900"
							: ""
				}`}
			>
				{amountToNumber(bill.amount)}
			</div>
		</button>
	);
}
