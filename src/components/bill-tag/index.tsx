import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import TagList from "./list";

export const [TagListProvider, showTagList] = createConfirmProvider(TagList, {
    dialogTitle: "Edit Tag",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] overflow-hidden",
});

export default function TagSettingsItem() {
    const t = useIntl();
    return (
        <div className="edit-tag">
            <Button
                onClick={() => {
                    showTagList();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--tag-outline] size-5"></i>
                        {t("edit-tags")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
        </div>
    );
}
