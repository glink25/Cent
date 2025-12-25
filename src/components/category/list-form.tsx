import createConfirmProvider from "../confirm";
import CategoryList from "./list";

export const [CategoryListProvider, showCategoryList] = createConfirmProvider(
    CategoryList,
    {
        dialogTitle: "Category",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);
