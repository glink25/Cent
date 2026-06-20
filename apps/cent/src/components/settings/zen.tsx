import { useZen } from "@/hooks/use-zen";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";

const FOLLOW_DEFAULT = "__default__";
const NO_MODEL = "__none__";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const {
        settings: zen,
        configs: configList,
        defaultConfigId,
        updateSettings,
    } = useZen();

    const defaultConfigName = configList.find(
        (config) => config.id === defaultConfigId,
    )?.name;
    const selectedConfigExists =
        zen?.aiConfigId &&
        configList.some((config) => config.id === zen.aiConfigId);
    const aiConfigValue =
        zen?.aiConfigId === null || configList.length === 0
            ? NO_MODEL
            : selectedConfigExists
              ? (zen.aiConfigId as string)
              : FOLLOW_DEFAULT;
    const scheduledTime = zen?.scheduledTime ?? "21:00";

    return (
        <PopupLayout
            title={t("zen-settings-title")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4 divide-y">
                <div className="w-full min-h-10 pb-4 flex-shrink-0 flex flex-col justify-between items-center px-4 gap-2">
                    <i className="icon-[mdi--meditation] size-10"></i>
                    <div className="text-center text-xs opacity-70">
                        {t("zen-settings-desc")}
                    </div>
                </div>
                <div className="w-full min-h-10 flex-shrink-0 flex py-2 justify-between items-center px-4 gap-2">
                    <div className="text-sm min-w-0 flex-1">
                        <div>{t("zen-enable")}</div>
                        <div className="text-xs opacity-60">
                            {zen?.enabled
                                ? t("zen-enable-tip")
                                : t("zen-enable-desc")}
                        </div>
                    </div>
                    <Switch
                        checked={Boolean(zen?.enabled)}
                        onCheckedChange={(enabled) => {
                            void updateSettings({
                                enabled,
                                ...(configList.length === 0
                                    ? { aiConfigId: null }
                                    : {}),
                            });
                        }}
                    />
                </div>
                <div className="w-full min-h-10 flex-shrink-0 flex py-2 justify-between items-center px-4 gap-2">
                    <div className="text-sm min-w-0 flex-1">
                        <div>{t("zen-ai-model")}</div>
                    </div>
                    <Select
                        value={aiConfigValue}
                        onValueChange={(value) => {
                            void updateSettings({
                                aiConfigId:
                                    value === FOLLOW_DEFAULT
                                        ? undefined
                                        : value === NO_MODEL
                                          ? null
                                          : value,
                            });
                        }}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={FOLLOW_DEFAULT}>
                                {t("zen-follow-default")}
                                {defaultConfigName
                                    ? ` (${defaultConfigName})`
                                    : ""}
                            </SelectItem>
                            <SelectItem value={NO_MODEL}>
                                {t("zen-no-model")}
                            </SelectItem>
                            {configList.map((config) => (
                                <SelectItem key={config.id} value={config.id}>
                                    {config.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full min-h-10 flex-shrink-0 flex py-2 justify-between items-center px-4 gap-2">
                    <div className="text-sm min-w-0 flex-1">
                        <div>{t("zen-scheduled-time")}</div>
                    </div>
                    <Input
                        type="time"
                        value={scheduledTime}
                        className="w-32"
                        onChange={(event) => {
                            void updateSettings({
                                scheduledTime: event.currentTarget.value,
                            });
                        }}
                    />
                </div>
            </div>
        </PopupLayout>
    );
}

const [ZenSettingsProvider, showZenSettings] = createConfirmProvider(Form, {
    dialogTitle: "Zen Settings",
    dialogModalClose: false,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(520px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[500px]",
});

export default function ZenSettingsItem() {
    const tagNewClassName = `relative after:content-['new'] after:rounded after:bg-[red] after:text-white after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(100%+4px)]`;

    const t = useIntl();
    return (
        <div className="zen-settings">
            <Button
                onClick={() => {
                    showZenSettings();
                }}
                variant="ghost"
                className={"w-full py-4 rounded-none h-auto"}
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div
                        className={cn(
                            tagNewClassName,
                            "flex items-center gap-2",
                        )}
                    >
                        <i className="icon-[mdi--meditation] size-5"></i>
                        {t("zen-settings-title")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <ZenSettingsProvider />
        </div>
    );
}
