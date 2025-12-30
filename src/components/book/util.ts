import createConfirmProvider from "../confirm";
import { BookConfirmForm } from "./form";

export const [BookConfirmProvider, showBookGuide] = createConfirmProvider(
    BookConfirmForm,
    {
        dialogTitle: "Books",
        dialogModalClose: true,
        contentClassName: "max-h-[55vh] w-fit max-w-[500px]",
    },
);
