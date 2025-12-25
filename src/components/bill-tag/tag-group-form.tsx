import createConfirmProvider from "../confirm";
import { EditTagGroupForm } from "./tag-group";

export const [EditTagGroupProvider, showEditTagGroup] = createConfirmProvider(
    EditTagGroupForm,
    {
        dialogTitle: "Edit Tag Group",
        dialogModalClose: false,
        fade: true,
        swipe: false,
        contentClassName: "w-[350px] h-[480px] max-h-[55vh] py-4",
    },
);
