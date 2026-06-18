import { useShallow } from "zustand/shallow";
import PopupLayout from "@/layouts/popup-layout";
import type { PersonalMeta } from "@/ledger/extra-type";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
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

const FOLLOW_DEFAULT = "__default__";

type ZenFrequency = NonNullable<NonNullable<PersonalMeta["zen"]>["frequency"]>;

const frequencyOptions: { value: ZenFrequency; label: string }[] = [
    { value: "daily", label: "每天" },
    { value: "weekly", label: "每周" },
    { value: "monthly", label: "每月" },
    { value: "yearly", label: "每年" },
];

function updateZenSettings(value: NonNullable<PersonalMeta["zen"]>) {
    return useLedgerStore.getState().updatePersonalMeta((prev) => ({
        ...prev,
        zen: {
            ...prev.zen,
            ...value,
        },
    }));
}

function Form({ onCancel }: { onCancel?: () => void }) {
    const { id: userId } = useUserStore();
    const { configs, defaultConfigId, zen } = useLedgerStore(
        useShallow((state) => {
            const personal = state.infos?.meta.personal?.[userId];
            const assistant = personal?.assistant;
            return {
                configs: assistant?.configs,
                defaultConfigId: assistant?.defaultConfigId,
                zen: personal?.zen,
            };
        }),
    );

    const configList = configs ?? [];

    const defaultConfigName = configList.find(
        (config) => config.id === defaultConfigId,
    )?.name;
    const selectedConfigExists =
        zen?.aiConfigId &&
        configList.some((config) => config.id === zen.aiConfigId);
    const aiConfigValue = selectedConfigExists
        ? (zen?.aiConfigId as string)
        : FOLLOW_DEFAULT;
    const frequency = zen?.frequency ?? "daily";
    const scheduledTime = zen?.scheduledTime ?? "21:00";

    return (
        <PopupLayout
            title="Zen"
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4">
                <div className="w-full min-h-10 pb-4 flex-shrink-0 flex justify-between items-center px-4 gap-2">
                    <div className="text-sm min-w-0 flex-1">
                        <div>Zen AI 模型</div>
                    </div>
                    <Select
                        value={aiConfigValue}
                        onValueChange={(value) => {
                            void updateZenSettings({
                                aiConfigId:
                                    value === FOLLOW_DEFAULT
                                        ? undefined
                                        : value,
                            });
                        }}
                    >
                        <SelectTrigger className="w-40">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={FOLLOW_DEFAULT}>
                                跟随默认
                                {defaultConfigName
                                    ? ` (${defaultConfigName})`
                                    : ""}
                            </SelectItem>
                            {configList.map((config) => (
                                <SelectItem key={config.id} value={config.id}>
                                    {config.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full min-h-10 pb-4 flex-shrink-0 flex justify-between items-center px-4 gap-2">
                    <div className="text-sm min-w-0 flex-1">
                        <div>Zen 频率</div>
                    </div>
                    <Select
                        value={frequency}
                        onValueChange={(value: ZenFrequency) => {
                            void updateZenSettings({ frequency: value });
                        }}
                    >
                        <SelectTrigger className="w-32">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {frequencyOptions.map((option) => (
                                <SelectItem
                                    key={option.value}
                                    value={option.value}
                                >
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                <div className="w-full min-h-10 pb-4 flex-shrink-0 flex justify-between items-center px-4 gap-2">
                    <div className="text-sm min-w-0 flex-1">
                        <div>出现时间</div>
                    </div>
                    <Input
                        type="time"
                        value={scheduledTime}
                        className="w-32"
                        onChange={(event) => {
                            void updateZenSettings({
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
    dialogTitle: "Zen 设置",
    dialogModalClose: false,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(520px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[500px]",
});

export default function ZenSettingsItem() {
    return (
        <div className="zen-settings">
            <Button
                onClick={() => {
                    showZenSettings();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--meditation] size-5"></i>
                        Zen 设置
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <ZenSettingsProvider />
        </div>
    );
}
