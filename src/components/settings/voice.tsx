import { useShallow } from "zustand/shallow";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { usePreference } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { isSpeechRecognitionSupported } from "../add-button/recognize";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const { id: userId } = useUserStore();

    // 获取AI配置信息
    const { configs = [], defaultConfigId } = useLedgerStore(
        useShallow((state) => {
            const assistantData =
                state.infos?.meta.personal?.[userId]?.assistant;
            return {
                configs: assistantData?.configs,
                defaultConfigId: assistantData?.defaultConfigId,
            };
        }),
    );

    // 判断是否有可用的AI配置
    const hasAIConfig = configs.length > 0 && defaultConfigId;

    // 语音记账开关状态
    const [voiceEnabled, setVoiceEnabled] = usePreference(
        "voiceRecordingEnabled",
    );

    const [voiceByKeyboard, setVoiceByKeyboard] =
        usePreference("voiceByKeyboard");

    return (
        <PopupLayout
            title={t("voice-recording-settings")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4">
                {/* 语音记账开关 */}
                <div className="w-full min-h-10 pb-2 flex justify-between items-center px-4 gap-2">
                    <div className="text-sm">
                        <div>{t("enable-voice-recording")}</div>
                        <div className="text-xs opacity-60">
                            {hasAIConfig
                                ? voiceEnabled
                                    ? t("voice-recording-tip")
                                    : t("voice-recording-description")
                                : t("voice-recording-requires-ai-config")}
                        </div>
                    </div>
                    <Switch
                        checked={Boolean(voiceEnabled && hasAIConfig)}
                        onCheckedChange={(checked) => {
                            if (hasAIConfig) {
                                setVoiceEnabled(checked);
                                if (checked) {
                                    const isSupported =
                                        isSpeechRecognitionSupported();
                                    if (!isSupported) {
                                        setVoiceByKeyboard(true);
                                    }
                                }
                            }
                        }}
                        disabled={!hasAIConfig}
                    />
                </div>

                {/* 提示信息 */}
                {!hasAIConfig && (
                    <div className="px-4 py-2">
                        <div className="text-xs p-3 bg-yellow-50 dark:bg-yellow-950 border border-yellow-200 dark:border-yellow-800 rounded-md">
                            <div className="flex items-start gap-2">
                                <i className="icon-[mdi--information-outline] size-4 flex-shrink-0 mt-0.5"></i>
                                <div>{t("voice-recording-setup-tip")}</div>
                            </div>
                        </div>
                    </div>
                )}
                {voiceEnabled && (
                    <div className="w-full min-h-10 pb-2 flex justify-between items-center px-4 gap-2">
                        <div className="text-sm">
                            <div>
                                {t("use-keyboard-input-instead-of-voice")}
                            </div>
                            <div className="text-xs opacity-60">
                                {t("use-keyboard-input-description")}
                            </div>
                        </div>
                        <Switch
                            checked={Boolean(voiceByKeyboard)}
                            onCheckedChange={(checked) => {
                                setVoiceByKeyboard(checked);
                            }}
                        />
                    </div>
                )}
            </div>
        </PopupLayout>
    );
}

const [VoiceSettingsProvider, showVoiceSettings] = createConfirmProvider(Form, {
    dialogTitle: "voice-recording-settings",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

export default function VoiceSettingsItem() {
    const t = useIntl();
    const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]`;

    return (
        <div className="voice-settings">
            <Button
                onClick={() => {
                    showVoiceSettings();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className={`${betaClassName} flex items-center gap-2`}>
                        <i className="icon-[mdi--microphone-outline] size-5"></i>
                        {t("voice-recording-settings")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <VoiceSettingsProvider />
        </div>
    );
}
