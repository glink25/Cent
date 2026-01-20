import type { ReactNode } from "react";
import createConfirmProvider from "../confirm";
import Form from "./form";
import type { SortableItem } from "./list";

export const [SortableListProvider, showSortableList] = createConfirmProvider(
    Form as any,
    {
        dialogTitle: "Sort",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
) as unknown as [
    () => ReactNode,
    <T extends SortableItem>(value?: T[]) => Promise<T[]>,
];
