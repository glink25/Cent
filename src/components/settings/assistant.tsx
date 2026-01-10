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
import { Input } from "../ui/input";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const { id: userId } = useUserStore();
    const apiKey = useLedgerStore(
        useShallow(
            (state) =>
                state.infos?.meta.personal?.[userId]?.assistant?.bigmodel
                    ?.apiKey ?? "",
        ),
    );

    const [apiKeyValue, setApiKeyValue] = useState(apiKey);

    // 同步 store 的值到本地状态
    useEffect(() => {
        setApiKeyValue(apiKey);
    }, [apiKey]);

    const handleApiKeyChange = useCallback((value: string) => {
        setApiKeyValue(value);
    }, []);

    const handleSave = useCallback(async () => {
        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            if (!prev.assistant) {
                prev.assistant = {};
            }
            if (!prev.assistant.bigmodel) {
                prev.assistant.bigmodel = {};
            }
            prev.assistant.bigmodel.apiKey = apiKeyValue;
            return prev;
        });
        toast.success(t("assistant-api-key-saved"));
    }, [apiKeyValue, t]);

    const handleClear = useCallback(() => {
        setApiKeyValue("");
    }, []);

    return (
        <PopupLayout
            title={t("ai-assistant")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4">
                <div className="px-4 pb-4">
                    <p className="text-xs opacity-60">
                        {t("assistant-description")}
                    </p>
                </div>

                {/* 智谱 GLM API Key 配置 */}
                <div className="px-4 pb-4">
                    <div className="text-sm py-1">{t("bigmodel-api-key")}</div>
                    <div className="pb-2">
                        <div className="text-xs opacity-60 mb-2">
                            {t("bigmodel-api-key-description")}
                        </div>
                        <Input
                            name="bigmodel-apikey"
                            placeholder={t("bigmodel-api-key-placeholder")}
                            className="w-full"
                            value={apiKeyValue}
                            onChange={(e) => {
                                handleApiKeyChange(e.currentTarget.value);
                            }}
                        />
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

const [AssistantProvider, showAssistant] = createConfirmProvider(Form, {
    dialogTitle: "ai-assistant",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

export default function AssistantSettingsItem() {
    const t = useIntl();
    const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]`;

    return (
        <div className="assistant">
            <Button
                onClick={() => {
                    showAssistant();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div
                        className={cn(betaClassName, "flex items-center gap-2")}
                    >
                        <i className="icon-[mdi--robot-outline] size-5"></i>
                        {t("ai-assistant")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <AssistantProvider />
        </div>
    );
}
