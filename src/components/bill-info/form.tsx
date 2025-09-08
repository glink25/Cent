import { type EditBill, useLedgerStore } from "@/store/ledger";
import { showBillEditor } from "../bill-editor";

export default function BillInfo({
	edit,
	onConfirm,
	onCancel,
}: {
	edit?: EditBill;
	onConfirm?: (v: any) => void;
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
							useLedgerStore.getState().updateBill(edit.id, newBill);
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
						}
					}}
				>
					delete
				</button>
			</div>
		</div>
	);
}
