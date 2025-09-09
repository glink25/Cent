import { type EditBill, useLedgerStore } from "@/store/ledger";
import { showBillEditor } from "../bill-editor";

export default function BillInfo({
	edit,
	onConfirm,
	onCancel,
}: {
	edit?: EditBill;
	onConfirm?: (isEdit: boolean) => void;
	onCancel?: () => void;
}) {
	return (
		<div>
			{JSON.stringify(edit)}
			<div>
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
			</div>
		</div>
	);
}
