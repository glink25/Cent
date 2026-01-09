import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";

const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]`;

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const { id: userId } = useUserStore();
    const customCSS = useLedgerStore(
        useShallow(
            (state) => state.infos?.meta.personal?.[userId]?.customCSS ?? "",
        ),
    );

    const [cssValue, setCssValue] = useState(customCSS);

    // 同步 store 的值到本地状态
    useEffect(() => {
        setCssValue(customCSS);
    }, [customCSS]);

    const handleCssChange = useCallback((value: string) => {
        setCssValue(value);
    }, []);

    const handleSave = useCallback(async () => {
        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            prev.customCSS = cssValue;
            return prev;
        });
        toast.success(t("custom-css-saved"));
    }, [cssValue, t]);

    const handleClear = useCallback(() => {
        setCssValue("");
    }, []);

    return (
        <PopupLayout
            title={t("preset")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4">
                <div className="px-4 pb-4">
                    <p className="text-xs opacity-60">
                        {t("preset-description")}
                    </p>
                </div>

                {/* 主题市场占位组件 */}
                <div className="px-4 pb-4">
                    <div className="text-sm py-1">{t("theme-market")}</div>
                    <div className="w-full border rounded-md p-4 flex flex-col items-center justify-center gap-2 bg-muted/30">
                        <i className="icon-[mdi--store-outline] size-8 opacity-40"></i>
                        <div className="text-sm opacity-60 text-center">
                            {t("theme-market-coming-soon")}
                        </div>
                    </div>
                </div>

                {/* 自定义CSS */}
                <div className="px-4 pb-4">
                    <div className="text-sm py-1">{t("custom-css")}</div>
                    <div className="pb-2">
                        <div className="text-xs opacity-60 mb-2">
                            {t("custom-css-description")}
                        </div>
                        <textarea
                            placeholder={t("custom-css-placeholder")}
                            className="w-full border rounded-md p-3 h-40 resize-none text-sm font-mono"
                            value={cssValue}
                            onChange={(e) => {
                                handleCssChange(e.currentTarget.value);
                            }}
                        ></textarea>
                        <div className="flex gap-2 mt-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleClear}
                                className="flex-1"
                            >
                                {t("clear")}
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                onClick={handleSave}
                                className="flex-1"
                            >
                                {t("save")}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </PopupLayout>
    );
}

const [PresetProvider, showPreset] = createConfirmProvider(Form, {
    dialogTitle: "preset",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

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
