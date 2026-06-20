import createConfirmProvider from "../confirm";
import ScheduledListForm from "./list";

export const [ScheduledProvider, showScheduled] = createConfirmProvider(
    ScheduledListForm,
    {
        dialogTitle: "Scheduled",
        dialogModalClose: false,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(520px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[500px]",
    },
);
