import createConfirmProvider from "../confirm";
import ScheduledEditForm from "./form";

export const [ScheduledEditProvider, showScheduledEdit] = createConfirmProvider(
    ScheduledEditForm,
    {
        dialogTitle: "Scheduled Edit",
        dialogModalClose: false,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);
