import { type EditBill, useLedgerStore } from "@/store/ledger";
import createConfirmProvider from "../confirm";
import EditorForm from "./form";

const confirms = createConfirmProvider(EditorForm, {
    dialogTitle: "Edit Bill",
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[85vh] sm:w-[90vw] sm:max-w-[600px]",
});

const [BillEditorProvider, showBillEditor] = confirms;

export { BillEditorProvider, showBillEditor };

export const goAddBill = async (value?: EditBill | undefined) => {
    const newBill = await showBillEditor(value);
    await useLedgerStore.getState().addBill(newBill);
};
