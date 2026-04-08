import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { WidgetEditProvider } from "./edit-form";
import { showWidgetList, WidgetListProvider } from "./list-form";

export default function WidgetSettings() {
    const t = useIntl();
    return (
        <div className="widget-settings">
            <Button
                onClick={() => {
                    showWidgetList();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--view-grid-outline] size-5"></i>
                        {t("widget-settings")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <WidgetListProvider />
            <WidgetEditProvider />
        </div>
    );
}
