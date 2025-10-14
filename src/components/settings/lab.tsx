import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { usePreference } from "@/store/preference";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();

    const [autoLocateWhenAddBill, setAutoLocateWhenAddBill] = usePreference(
        "autoLocateWhenAddBill",
    );

    const [
        enterAddBillWhenReduceMotionChanged,
        setEnterAddBillWhenReduceMotionChanged,
    ] = usePreference("enterAddBillWhenReduceMotionChanged");

    return (
        <PopupLayout
            title={t("experimental-functions")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="divide-y divide-solid flex flex-col overflow-hidden py-4 gap-2">
                <div className="w-full h-10 flex justify-between items-center px-4">
                    <div className="text-sm">
                        <div>{t("auto-locate-when-add-bill")}</div>
                        <div className="text-xs opacity-60">
                            {t("auto-locate-when-add-bill-description")}
                        </div>
                    </div>
                    <Switch
                        checked={autoLocateWhenAddBill}
                        onCheckedChange={setAutoLocateWhenAddBill}
                    />
                </div>
                <div className="w-full h-10 flex justify-between items-center px-4">
                    <div className="text-sm">
                        <div>
                            {t("enter-add-bill-when-reduce-motion-changed")}
                        </div>
                        <div className="text-xs opacity-60">
                            {t(
                                "enter-add-bill-when-reduce-motion-changed-description",
                            )}
                        </div>
                    </div>
                    <Switch
                        checked={enterAddBillWhenReduceMotionChanged}
                        onCheckedChange={setEnterAddBillWhenReduceMotionChanged}
                    />
                </div>
            </div>
        </PopupLayout>
    );
}

const [LabSettingsProvider, showLabSettings] = createConfirmProvider(Form, {
    dialogTitle: "experimental-functions",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
});

export default function LabSettingsItem() {
    const t = useIntl();
    return (
        <div className="lab">
            <Button
                onClick={() => {
                    showLabSettings();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--flask] size-5"></i>
                        {t("experimental-functions")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <LabSettingsProvider />
        </div>
    );
}
