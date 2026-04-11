import createConfirmProvider from "../confirm";
import WidgetList from "./list";

export const [WidgetListProvider, showWidgetList] = createConfirmProvider(
    WidgetList,
    {
        dialogTitle: "Widget Settings",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);
