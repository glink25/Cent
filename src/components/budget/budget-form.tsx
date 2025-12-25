import createConfirmProvider from "../confirm";
import BudgetEditForm from "./form";

export const [BudgetEditProvider, showBudgetEdit] = createConfirmProvider(
    BudgetEditForm,
    {
        dialogTitle: "Budget Edit",
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);
