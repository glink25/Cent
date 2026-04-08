import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { Button } from "../ui/button";
import { WidgetEditProvider } from "./edit-form";
import { showWidgetList, WidgetListProvider } from "./list-form";

const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]`;

export default function WidgetSettings() {
    const t = useIntl();
    return (
        <div className="widget-settings">
            <Button
                onClick={() => {
                    showWidgetList();
                }}
                variant="ghost"
                className={cn("w-full py-4 rounded-none h-auto")}
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div
                        className={cn(betaClassName, "flex items-center gap-2")}
                    >
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
