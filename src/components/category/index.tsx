import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { CategoryListProvider, showCategoryList } from "./list-form";

export { CategoryListProvider, showCategoryList };

export default function CategorySettingsItem() {
    const t = useIntl();
    return (
        <div className="backup">
            <Button
                onClick={() => {
                    showCategoryList();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--view-grid-outline] size-5"></i>
                        {t("edit-categories")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
        </div>
    );
}
