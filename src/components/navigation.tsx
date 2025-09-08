import { useLedgerStore } from "@/store/ledger";
import { showBillEditor } from "./bill-editor";

export default function Navigation() {
	return (
		<div
			className="floating-tab fixed w-screen h-18 flex items-center justify-around sm:h-screen
         sm:w-18 sm:flex-col sm:justify-start z-0 
         bottom-[calc(.25rem+env(safe-area-inset-bottom))]
         md:top-[env(safe-area-inset-top)] md:left-[calc(.25rem+env(safe-area-inset-left))]"
		>
			<button
				type="button"
				className="cursor-pointer"
				onClick={async () => {
					const newBill = await showBillEditor();
					await useLedgerStore.getState().addBill(newBill);
				}}
			>
				Add
			</button>
		</div>
	);
}
