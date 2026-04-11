import createConfirmProvider from "../confirm";
import WidgetEdit from "./edit";
import type { Widget } from "./type";

export const [WidgetEditProvider, showWidgetEdit] = createConfirmProvider(
    WidgetEdit,
    {
        dialogTitle: "Widget Edit",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[90vh] sm:w-[90vw] sm:max-w-[900px]",
    },
);

export type { Widget };
