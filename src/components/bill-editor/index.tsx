import createConfirmProvider from "../confirm";
import EditorForm from "./form";

export const [BillEditorProvider, showBillEditor] = createConfirmProvider(
	EditorForm,
	{
		dialogTitle: "Edit Bill",
	},
);
