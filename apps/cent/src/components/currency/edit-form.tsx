import createConfirmProvider from "../confirm";
import { EditCurrencyForm } from "./edit";

export const [EditCurrencyProvider, showEditCurrency] = createConfirmProvider(
    EditCurrencyForm,
    {
        dialogTitle: "Edit Currency",
        dialogModalClose: false,
        fade: true,
        swipe: false,
        contentClassName: "w-[350px] h-[480px] max-h-[55vh] py-4",
    },
);
