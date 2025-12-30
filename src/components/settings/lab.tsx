import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { usePreference } from "@/store/preference";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import KeyboardHeightSettings from "./keyboard";
import { PredictSettings } from "./predict";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();

    const [autoLocateWhenAddBill, setAutoLocateWhenAddBill] = usePreference(
        "autoLocateWhenAddBill",
    );

    const [
        enterAddBillWhenReduceMotionChanged,
        setEnterAddBillWhenReduceMotionChanged,
    ] = usePreference("enterAddBillWhenReduceMotionChanged");

    const [
        readClipboardWhenReduceMotionChanged,
        setReadClipboardWhenReduceMotionChanged,
    ] = usePreference("readClipboardWhenReduceMotionChanged");

    const [multiplyKey, setMultiplyKey] = usePreference("multiplyKey");

    return (
        <PopupLayout
            title={t("more-functions")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4">
                <div className="text-xs opacity-60 px-4 py-1">
                    {t("bill-record-settings")}
                </div>
                <div className="flex-shrink-0 divide-y divide-solid flex flex-col overflow-hidden gap-2">
                    <PredictSettings />
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
                            <div>{t("multiply-key")}</div>
                            <div className="text-xs opacity-60">
                                {t("multiply-key-tip")}
                            </div>
                        </div>
                        <Select
                            value={multiplyKey ?? "off"}
                            onValueChange={setMultiplyKey}
                        >
                            <SelectTrigger>
                                <SelectValue></SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="off">{t("off")}</SelectItem>
                                <SelectItem value="double-zero">00</SelectItem>
                                <SelectItem value="triple-zero">000</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <KeyboardHeightSettings />
                </div>

                <div className="text-xs opacity-60 px-4 py-1 pt-4">
                    {t("experimental-functions")}
                </div>
                <div className="flex-shrink-0 divide-y divide-solid flex flex-col overflow-hidden gap-2">
                    <div className="w-full h-10 flex justify-between items-center px-4">
                        <div className="text-sm">
                            <div>
                                {t("enter-add-bill-when-reduce-motion-changed")}
                            </div>
                            <div className="text-xs opacity-60">
                                {t(
                                    "enter-add-bill-when-reduce-motion-changed-description",
                                )}
                                <a
                                    href="https://glink25.github.io/post/Cent-PWA%E5%B0%8F%E6%8A%80%E5%B7%A7/#%E5%BF%AB%E6%8D%B7%E8%AE%B0%E8%B4%A6"
                                    className="underline px-2"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    Tips
                                </a>
                            </div>
                        </div>
                        <Switch
                            checked={enterAddBillWhenReduceMotionChanged}
                            onCheckedChange={
                                setEnterAddBillWhenReduceMotionChanged
                            }
                        />
                    </div>
                    <div className="w-full h-10 flex justify-between items-center px-4">
                        <div className="text-sm">
                            <div>
                                {t("quick-add-when-reduce-motion-changed")}
                            </div>
                            <div className="text-xs opacity-60">
                                {t(
                                    "enter-add-bill-when-reduce-motion-changed-description",
                                )}
                                <a
                                    href="https://glink25.github.io/post/Cent-%E5%B7%B2%E6%94%AF%E6%8C%81%E5%A4%9A%E5%B8%81%E7%A7%8D%E8%87%AA%E5%8A%A8%E8%AE%B0%E8%B4%A6/#iOS%E5%BF%AB%E6%8D%B7%E6%8C%87%E4%BB%A4%E5%BF%AB%E9%80%9F%E8%AE%B0%E8%B4%A6"
                                    className="underline px-2"
                                    target="_blank"
                                    rel="noopener"
                                >
                                    Tips
                                </a>
                            </div>
                        </div>
                        <Switch
                            checked={readClipboardWhenReduceMotionChanged}
                            onCheckedChange={
                                setReadClipboardWhenReduceMotionChanged
                            }
                        />
                    </div>
                </div>
            </div>
        </PopupLayout>
    );
}

const [LabSettingsProvider, showLabSettings] = createConfirmProvider(Form, {
    dialogTitle: "experimental-functions",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
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
                        {t("more-functions")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <LabSettingsProvider />
        </div>
    );
}

/** @deprecated */
// function RelayrSettings() {
//     const t = useIntl();
//     const [
//         readReLayrWhenReduceMotionChanged,
//         setReadReLayrWhenReduceMotionChanged,
//     ] = usePreference("quickEntryWithReLayr");
//     const [port, setPort] = usePreference("reLayrPort");
//     const [key, setKey] = usePreference("reLayrKey");

//     return (
//         <div className="w-full flex flex-col gap-2 px-4">
//             <div className="h-10 flex justify-between items-center ">
//                 <div className="text-sm">
//                     <div>通过ReLayr自动记账</div>
//                     <div className="text-xs opacity-60">
//                         <a
//                             href="https://glink25.github.io/post/Cent-%E5%B7%B2%E6%94%AF%E6%8C%81%E5%A4%9A%E5%B8%81%E7%A7%8D%E8%87%AA%E5%8A%A8%E8%AE%B0%E8%B4%A6/#iOS%E5%BF%AB%E6%8D%B7%E6%8C%87%E4%BB%A4%E5%BF%AB%E9%80%9F%E8%AE%B0%E8%B4%A6"
//                             className="underline px-2"
//                             target="_blank"
//                             rel="noopener"
//                         >
//                             了解详情
//                         </a>
//                     </div>
//                 </div>
//                 <Switch
//                     checked={readReLayrWhenReduceMotionChanged}
//                     onCheckedChange={setReadReLayrWhenReduceMotionChanged}
//                 />
//             </div>
//             {readReLayrWhenReduceMotionChanged && (
//                 <div className="flex justify-between gap-2">
//                     <Label className="flex flex-col gap-1 text-xs">
//                         <span>端口</span>
//                         <Input
//                             value={port}
//                             onChange={(e) => {
//                                 setPort(e.currentTarget.value);
//                             }}
//                             placeholder="2525"
//                         ></Input>
//                     </Label>
//                     <Label className="flex flex-col gap-1 text-xs">
//                         <span>Key</span>
//                         <Input
//                             value={key}
//                             onChange={(e) => {
//                                 setKey(e.currentTarget.value);
//                             }}
//                             placeholder={"cent"}
//                         ></Input>
//                     </Label>
//                 </div>
//             )}
//         </div>
//     );
// }
