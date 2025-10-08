import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useTag } from "@/hooks/use-tag";
import { amountToNumber } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { type EditBill, useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { formatTime } from "@/utils/time";
import { showBillEditor } from "../bill-editor";
import CategoryIcon from "../category/icon";
import SmartImage from "../image";

export default function BillInfo({
	edit,
	onConfirm,
	onCancel,
}: {
	edit?: EditBill;
	onConfirm?: (isEdit: boolean) => void;
	onCancel?: () => void;
}) {
	const t = useIntl();
	const { id: curUserId } = useUserStore();
	const { categories } = useCategory();

	const creators = useCreators();
	const creator = creators.find((c) => c.id === edit?.creatorId);
	const { tags: allTags } = useTag();
	const tags = edit?.tagIds
		?.map((id) => allTags.find((t) => t.id === id))
		.filter((v) => v !== undefined);
	const { name, login } = creator ?? { name: undefined, login: undefined };
	const { login: selfLogin, id: selfId } = useUserStore();
	const isMe = login === selfLogin || login === selfId;

	if (!edit) {
		return null;
	}
	const categoryInfo = categories.find((c) => c.id === edit.categoryId);

	const toEdit = async () => {
		if (edit?.id) {
			const newBill = await showBillEditor(edit);
			await useLedgerStore.getState().updateBill(edit.id, newBill);
			onConfirm?.(true);
		}
	};
	const toDelete = () => {
		if (edit?.id) {
			useLedgerStore.getState().removeBill(edit?.id);
			onConfirm?.(false);
		}
	};
	const toClose = () => {
		onCancel?.();
	};
	return (
		<div>
			<div className="min-h-[320px] p-4 flex flex-col w-full h-full">
				<div className="flex-1 flex flex-col">
					{/* header */}
					<div className="flex items-center justify-between">
						<div className="flex items-center">
							<div className="w-12 h-12 flex-shrink-0 rounded-full bg-white border p-4 flex items-center justify-center">
								{categoryInfo?.icon && (
									<CategoryIcon icon={categoryInfo?.icon} />
								)}
							</div>
							<div className="flex text-md font-semibold px-2">
								<div>{categoryInfo?.name ?? ""}</div>
							</div>
						</div>
						<div
							className={`text-2xl font-bold flex overflow-x-auto ${
								edit.type === "expense" ? "text-red-700" : "text-green-900"
							}`}
						>
							<div>{edit.type === "expense" ? "-" : "+"}</div>
							<div>{amountToNumber(edit.amount)}</div>
						</div>
					</div>

					<div className="w-full border border-dashed my-2"></div>

					{/* details */}
					<div className="text-gray-500">
						<div className="flex justify-between items-center my-1">
							<div>{t("comment")}:</div>
							<div className="flex-1 overflow-x-auto text-right">
								{edit.comment}
							</div>
						</div>
						<div className="flex justify-between items-center my-1">
							<div>{t("creator")}:</div>
							<div>{isMe ? t("me") : name}</div>
						</div>
						<div className="flex justify-between items-center my-1">
							<div>{t("time")}:</div>
							<div>{formatTime(edit.time)}</div>
						</div>
						{tags?.length && (
							<div className="flex justify-between items-start my-1">
								<div>{t("tags")}:</div>
								<div className="flex flex-wrap gap-1 justify-end max-w-[80%]">
									{tags?.map((t) => (
										<span key={t.id}>#{t.name}</span>
									))}
								</div>
							</div>
						)}
					</div>

					{edit.image && (
						<div className="flex-1 py-2 flex items-center justify-center">
							<SmartImage
								source={edit.image}
								alt=""
								className="max-h-[200px] object-contain rounded min-w-24 min-h-24 animate-dynamic-bg"
								style={
									{
										"--color-start":
											"color-mix(in oklab, var(--primary) 10%, transparent)",
										" --color-end":
											"color-mix(in oklab, var(--primary) 80%, transparent)",
									} as any
								}
							/>
						</div>
					)}
				</div>

				{/* footer */}
				<div className="footer flex justify-between items-center">
					<div className="flex">
						{edit.creatorId === curUserId && (
							<button
								type="button"
								className="buttoned px-2 rounded-md text-red-600 cursor-pointer"
								onClick={toDelete}
							>
								{t("delete")}
							</button>
						)}
					</div>
					<div className="flex">
						<button
							type="button"
							className="buttoned px-2 rounded-md cursor-pointer"
							onClick={toClose}
						>
							{t("cancel")}
						</button>
						{edit.creatorId === curUserId && (
							<button
								type="button"
								className="buttoned ml-2 px-2 rounded-md font-semibold cursor-pointer"
								onClick={toEdit}
							>
								{t("edit")}
							</button>
						)}
					</div>
				</div>
			</div>
			{/* <div>
				<button
					type="button"
					onClick={async () => {
						if (edit?.id) {
							const newBill = await showBillEditor(edit);
							await useLedgerStore.getState().updateBill(edit.id, newBill);
							onConfirm?.(true);
						}
					}}
				>
					edit
				</button>
				<button
					type="button"
					onClick={() => {
						if (edit?.id) {
							useLedgerStore.getState().removeBill(edit?.id);
							onConfirm?.(false);
						}
					}}
				>
					delete
				</button>
			</div> */}
		</div>
	);
}
