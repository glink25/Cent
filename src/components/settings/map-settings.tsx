import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { decodeApiKey, encodeApiKey } from "@/utils/api-key";
import createConfirmProvider from "../confirm";
import modal from "../modal";
import { Button } from "../ui/button";
import { Input } from "../ui/input";

// 地图配置表单
function MapConfigForm({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();

    // 获取当前配置
    const mapConfig = useLedgerStore(
        useShallow((state) => state.infos?.meta.map),
    );

    const [amapKey, setAmapKey] = useState(
        mapConfig?.amapKey ? decodeApiKey(mapConfig.amapKey) : "",
    );
    const [amapSecurityCode, setAmapSecurityCode] = useState(
        mapConfig?.amapSecurityCode
            ? decodeApiKey(mapConfig.amapSecurityCode)
            : "",
    );
    const [showAmapKey, setShowAmapKey] = useState(false);
    const [showAmapSecurityCode, setShowAmapSecurityCode] = useState(false);

    const handleSave = useCallback(async () => {
        // 验证
        if (!amapKey.trim()) {
            toast.error(t("amap-key-required"));
            return;
        }
        if (!amapSecurityCode.trim()) {
            toast.error(t("amap-security-code-required"));
            return;
        }

        // 保存配置
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            if (!prev.map) {
                prev.map = {};
            }

            prev.map.amapKey = encodeApiKey(amapKey.trim());
            prev.map.amapSecurityCode = encodeApiKey(amapSecurityCode.trim());

            return prev;
        });

        toast.success(t("map-config-saved"));
        onCancel?.();
    }, [amapKey, amapSecurityCode, onCancel, t]);

    const handleClear = useCallback(async () => {
        await modal.prompt({ title: t("are-you-sure-to-clear-map-config") });
        // 清除配置
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            if (prev.map) {
                delete prev.map.amapKey;
                delete prev.map.amapSecurityCode;
            }
            return prev;
        });

        setAmapKey("");
        setAmapSecurityCode("");
        toast.success(t("map-config-cleared"));
        onCancel?.();
    }, [onCancel, t]);

    const hasConfig = mapConfig?.amapKey || mapConfig?.amapSecurityCode;

    return (
        <PopupLayout
            title={t("map-settings")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col pb-4 gap-4 overflow-hidden">
                <div className="flex-1 flex flex-col gap-4 overflow-y-auto">
                    {/* 说明文本 */}
                    <div className="px-4">
                        <div className="text-sm opacity-60">
                            {t("map-settings-description")}
                        </div>
                    </div>

                    {/* 高德地图 Key */}
                    <div className="px-4">
                        <div className="text-sm py-1 font-medium">
                            {t("amap-key")}
                        </div>
                        <div className="relative">
                            <Input
                                name="amap-key"
                                type={showAmapKey ? "text" : "password"}
                                placeholder={t("amap-key-placeholder")}
                                value={amapKey}
                                onChange={(e) =>
                                    setAmapKey(e.currentTarget.value)
                                }
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() => setShowAmapKey(!showAmapKey)}
                                className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                {showAmapKey ? (
                                    <i className="icon-[mdi--eye-off] size-4"></i>
                                ) : (
                                    <i className="icon-[mdi--eye] size-4"></i>
                                )}
                            </button>
                        </div>
                        <div className="text-xs opacity-60 mt-1">
                            {t("amap-key-description")}
                        </div>
                    </div>

                    {/* 高德地图安全密钥 */}
                    <div className="px-4">
                        <div className="text-sm py-1 font-medium">
                            {t("amap-security-code")}
                        </div>
                        <div className="relative">
                            <Input
                                name="amap-security-code"
                                type={
                                    showAmapSecurityCode ? "text" : "password"
                                }
                                placeholder={t(
                                    "amap-security-code-placeholder",
                                )}
                                value={amapSecurityCode}
                                onChange={(e) =>
                                    setAmapSecurityCode(e.currentTarget.value)
                                }
                                className="pr-10"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    setShowAmapSecurityCode(
                                        !showAmapSecurityCode,
                                    )
                                }
                                className="absolute right-0 top-0 h-full px-3 flex items-center text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                            >
                                {showAmapSecurityCode ? (
                                    <i className="icon-[mdi--eye-off] size-4"></i>
                                ) : (
                                    <i className="icon-[mdi--eye] size-4"></i>
                                )}
                            </button>
                        </div>
                        <div className="text-xs opacity-60 mt-1">
                            {t("amap-security-code-description")}
                        </div>
                    </div>

                    {/* 帮助链接 */}
                    <div className="px-4">
                        <div className="text-xs opacity-60">
                            {t("map-settings-help", {
                                a: (chunks: React.ReactNode) => (
                                    <a
                                        href="https://lbs.amap.com/api/jsapi-v2/guide/abc/prepare"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-blue-500 hover:text-blue-600 underline"
                                    >
                                        {chunks}
                                    </a>
                                ),
                            })}
                        </div>
                    </div>
                </div>

                {/* 按钮组 */}
                <div className="px-4 flex flex-col gap-2">
                    {hasConfig && (
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClear}
                            className="w-full text-red-500 hover:text-red-600"
                        >
                            {t("clear-map-config")}
                        </Button>
                    )}
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onCancel}
                            className="flex-1"
                        >
                            {t("cancel")}
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
        </PopupLayout>
    );
}

const [MapConfigFormProvider, showMapConfig] = createConfirmProvider(
    MapConfigForm,
    {
        dialogTitle: "map-settings",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);

export default function MapSettingsItem() {
    const t = useIntl();
    return (
        <div className="map-settings">
            <Button
                onClick={() => {
                    showMapConfig();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--map-outline] size-5"></i>
                        {t("map-settings")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <MapConfigFormProvider />
        </div>
    );
}
