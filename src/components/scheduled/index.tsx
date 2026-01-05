import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { Button } from "../ui/button";
import { ScheduledProvider, showScheduled } from "./list-form";
import { ScheduledEditProvider, showScheduledEdit } from "./scheduled-form";

export { ScheduledProvider, showScheduled };
export { ScheduledEditProvider, showScheduledEdit };

export default function Scheduled() {
    const t = useIntl();
    const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]`;

    return (
        <div className="scheduled">
            <Button
                onClick={() => {
                    showScheduled();
                }}
                variant="ghost"
                className={cn("w-full py-4 rounded-none h-auto")}
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div
                        className={cn("flex items-center gap-2", betaClassName)}
                    >
                        <i className="icon-[mdi--calendar-clock] size-5"></i>
                        {t("scheduled-manager")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
        </div>
    );
}
