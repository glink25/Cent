import createConfirmProvider from "../confirm";
import type { BatchEditOptions } from "./batch-edit-form";
import BatchEditForm from "./batch-edit-form";

export type { BatchEditOptions };

export const [BatchEditProvider, showBatchEdit] = createConfirmProvider(
    BatchEditForm,
    {
        dialogTitle: "Batch Edit",
        dialogModalClose: true,
        fade: true,
        contentClassName: "rounded-md max-h-[65vh] w-[90vw] max-w-[500px]",
    },
);
