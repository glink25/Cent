import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { PresetProvider, showPreset } from "../preset";
import { Button } from "../ui/button";

const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]`;

export default function PresetSettingsItem() {
    const t = useIntl();
    return (
        <div className="preset">
            <Button
                onClick={() => {
                    showPreset();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div
                        className={cn(betaClassName, "flex items-center gap-2")}
                    >
                        <i className="icon-[mdi--palette-outline] size-5"></i>
                        {t("preset")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <PresetProvider />
        </div>
    );
}
