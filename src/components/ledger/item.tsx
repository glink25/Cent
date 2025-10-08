import { useMemo } from "react";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useTag } from "@/hooks/use-tag";
import { amountToNumber } from "@/ledger/bill";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { denseTime, shortTime } from "@/utils/time";
import CategoryIcon from "../category/icon";

interface BillItemProps {
	bill: Bill;
	onClick?: () => void;
	className?: string;
	showTime?: boolean;
}

export default function BillItem({
	bill,
	className,
	onClick,
	showTime,
}: BillItemProps) {
	const t = useIntl();
	const { categories } = useCategory();
	const { tags: allTags } = useTag();
	const category = useMemo(
		() => categories.find((c) => c.id === bill.categoryId),
		[bill.categoryId, categories],
	);

	const { login: selfLogin, id: selfId } = useUserStore();
	const creators = useCreators();
	const creator = creators.find((c) => c.id === bill.creatorId);
	const isMe = creator?.login === selfLogin || creator?.login === selfId;
	const tags = bill.tagIds
		?.map((id) => allTags.find((t) => t.id === id))
		.filter((v) => v !== undefined);

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
					{category?.icon && <CategoryIcon icon={category.icon} />}
				</div>
				<div className="flex-1 flex flex-col px-4 overflow-hidden">
					<div className="flex text-md gap-1 h-6">
						<div className="flex-shrink-0 font-semibold">
							{category ? category.name : ""}
						</div>
						<div className="flex flex-wrap gap-x-2 gap-y-1">
							{tags?.map((tag) => (
								<div
									key={tag.id}
									className="text-[10px] rounded border flex items-center p-[2px] h-3"
								>
									{tag.name}
								</div>
							))}
						</div>
					</div>
					<div className="flex text-xs">
						<div>{isMe ? t("me") : (creator?.name ?? "unknown-user")}</div>
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
			<div>
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
				{showTime && (
					<div className="text-[8px] text-foreground/60">
						{denseTime(bill.time)}
					</div>
				)}
			</div>
		</button>
	);
}
