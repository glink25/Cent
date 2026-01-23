import { useEffect, useState } from "react";
import { useCopyToClipboard } from "react-use";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { usePreferenceStore } from "@/store/preference";
import {
    getCategoriesStr,
    textToBillSystemPrompt,
} from "../assistant/text-to-bill";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";

/**
 * 生成随机字符串（用于 passcode）
 */
function generateRandomPasscode(): string {
    // 降级方案：使用 Math.random 生成随机字符串
    return Array.from({ length: 32 }, () =>
        Math.floor(Math.random() * 16).toString(16),
    ).join("");
}

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();

    // 获取 relayr 配置
    const relayrConfig = usePreferenceStore(
        useShallow((state) => state.relayr),
    );

    const [enable, setEnable] = useState(relayrConfig?.enable ?? false);
    const [secret, setSecret] = useState(relayrConfig?.passcode ?? "");
    const [showSecret, setShowSecret] = useState(false);
    const [configText, setConfigText] = useState<string>("");

    // 同步 store 的值到本地状态
    useEffect(() => {
        setEnable(relayrConfig?.enable ?? false);
        setSecret(relayrConfig?.passcode ?? "");
    }, [relayrConfig]);

    const handleEnableChange = (checked: boolean) => {
        setEnable(checked);
        usePreferenceStore.setState((prev) => {
            const currentRelayr = prev.relayr ?? {};
            // 如果开启 relayr 且之前没有设置过 passcode，则自动生成一个
            if (checked && !currentRelayr.passcode) {
                const newPasscode = generateRandomPasscode();
                // 立即更新本地状态
                setSecret(newPasscode);
                return {
                    ...prev,
                    relayr: {
                        ...currentRelayr,
                        enable: checked,
                        passcode: newPasscode,
                    },
                };
            }
            return {
                ...prev,
                relayr: {
                    ...currentRelayr,
                    enable: checked,
                },
            };
        });
    };

    const [, copy] = useCopyToClipboard();
    const handleSecretChange = (value: string) => {
        setSecret(value);
        usePreferenceStore.setState((prev) => ({
            ...prev,
            relayr: {
                ...(prev.relayr ?? {}),
                passcode: value,
            },
        }));
    };

    return (
        <PopupLayout
            title={t("quick-entry-settings")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4">
                {/* Relayr 开关 */}
                <div className="w-full min-h-10 pb-2 flex justify-between items-center px-4 gap-2">
                    <div className="text-sm">
                        <div>{t("enable-relayr")}</div>
                        <div className="text-xs opacity-60">
                            {t("enable-relayr-description")}
                        </div>
                    </div>
                    <Switch
                        checked={enable}
                        onCheckedChange={handleEnableChange}
                    />
                </div>

                {/* Secret 输入框 */}
                {enable && (
                    <div className="w-full px-4 pb-2 flex flex-col gap-2">
                        <div className="text-sm">
                            <div>{t("relayr-secret")}</div>
                            <div className="text-xs opacity-60">
                                {t("relayr-secret-description")}
                            </div>
                        </div>
                        <div className="relative">
                            <Input
                                type={showSecret ? "text" : "password"}
                                value={secret}
                                onChange={(e) =>
                                    handleSecretChange(e.target.value)
                                }
                                disabled
                                placeholder={t("relayr-secret-placeholder")}
                                className="w-full pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowSecret(!showSecret)}
                                className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                {showSecret ? (
                                    <i className="icon-[mdi--eye-off] size-4"></i>
                                ) : (
                                    <i className="icon-[mdi--eye] size-4"></i>
                                )}
                            </button>
                        </div>
                    </div>
                )}

                {/* For：iOS 区域 */}
                {enable && secret && (
                    <div className="w-full px-4 py-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm font-medium mb-3">
                            {t("ios")}
                        </div>

                        {/* 第一步：复制快捷指令配置 */}
                        <div className="mb-3">
                            <div className="text-xs opacity-60 mb-2">
                                {t("step-1")}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={async () => {
                                    const prompt = textToBillSystemPrompt(
                                        getCategoriesStr(),
                                    );
                                    const configTextValue = JSON.stringify({
                                        passcode: secret,
                                        prompt,
                                        relayrURL: import.meta.env
                                            .VITE_RELAYR_URL,
                                        relayrKey: import.meta.env
                                            .VITE_RELAYR_ANNON_KEY,
                                    });
                                    setConfigText(configTextValue);
                                    copy(configTextValue);
                                    toast.success(
                                        t("quick-entry-config-copied"),
                                        { duration: 2000 },
                                    );
                                }}
                                className="w-full"
                            >
                                <i className="icon-[mdi--content-copy] size-4 mr-2"></i>
                                {t("copy-quick-entry-config")}
                            </Button>
                            {configText && (
                                <div className="mt-2 h-[70px] overflow-y-auto !select-all text-xs text-gray-600 dark:text-gray-400 break-all font-mono bg-gray-50 dark:bg-gray-800 p-2 rounded border border-gray-200 dark:border-gray-700">
                                    {configText}
                                </div>
                            )}
                        </div>

                        {/* 第二步：安装快捷指令Relayr版 */}
                        <div>
                            <div className="text-xs opacity-60 mb-2">
                                {t("step-2")}
                            </div>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                    window.open(
                                        t("relayr-shortcut-link"),
                                        "_blank",
                                        "noopener,noreferrer",
                                    );
                                }}
                                className="w-full"
                            >
                                {t("install-shortcut")}
                            </Button>
                        </div>

                        {/* 帮助链接 */}
                        <div className="w-full px-4 pt-4 inline-flex justify-center">
                            <a
                                href={t("quick-entry-help-url")}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs opacity-60 hover:opacity-80 transition-opacity flex items-center gap-1 text-blue-500 hover:text-blue-600 underline"
                            >
                                <i className="icon-[mdi--help-circle-outline] size-4"></i>
                                {t("quick-entry-help-link")}
                            </a>
                        </div>
                    </div>
                )}

                {/* For：Android 区域 */}
                {enable && secret && (
                    <div className="w-full px-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <div className="text-sm font-medium mb-3">
                            {t("android")}
                        </div>
                        <div className="text-xs opacity-60">
                            {t("to-be-continued")}
                        </div>
                    </div>
                )}
            </div>
        </PopupLayout>
    );
}

const [QuickEntrySettingsProvider, showQuickEntrySettings] =
    createConfirmProvider(Form, {
        dialogTitle: "quick-entry-settings",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    });

export default function QuickEntrySettingsItem() {
    const t = useIntl();

    return (
        <div className="quick-entry-settings">
            <Button
                onClick={() => {
                    showQuickEntrySettings();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--lightning-bolt-outline] size-5"></i>
                        {t("quick-entry-settings")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <QuickEntrySettingsProvider />
        </div>
    );
}
