import { useLedgerStore } from "@/store/ledger";
import createConfirmProvider from "../confirm";
import EditorForm from "./form";

export const [BillEditorProvider, showBillEditor] = createConfirmProvider(
    EditorForm,
    {
        dialogTitle: "Edit Bill",
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[85vh] sm:w-[90vw] sm:max-w-[600px]",
    },
);

export const goAddBill = async () => {
    const newBill = await showBillEditor();
    await useLedgerStore.getState().addBill(newBill);
};
