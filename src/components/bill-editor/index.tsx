import createConfirmProvider from "../confirm";
import EditorForm from "./form";

export const [BillEditorProvider, showBillEditor] = createConfirmProvider(
	EditorForm,
	{
		dialogTitle: "Edit Bill",
		contentClassName:
			"h-full w-full max-h-full max-w-full rounded-none sm:rounded-md data-[state=open]:animate-slide-from-right sm:max-h-[85vh] sm:w-[90vw] sm:max-w-[600px] sm:data-[state=open]:animate-content-show",
	},
);
