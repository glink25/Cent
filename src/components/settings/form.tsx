import { StorageAPI, StorageDeferredAPI } from "@/api/storage";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useUserStore } from "@/store/user";
import TagSettingsItem from "../bill-tag";
import { BookSettings } from "../book";
import Budget from "../budget";
import CategorySettingsItem from "../category";
import CurrencySettingsItem from "../currency";
import DataManagerSettingsItem from "../data-manager";
import { Button } from "../ui/button";
import AboutSettingsItem from "./about";
import LabSettingsItem from "./lab";
import LanguageSettingsItem from "./language";
import ThemeSettingsItem from "./theme";
import UserSettingsItem from "./user";

function UserInfo() {
    const t = useIntl();
    const { id, avatar_url, name, expired } = useUserStore();
    const toLogOut = async () => {
        const ok = confirm(t("logout-warning"));
        if (!ok) {
            return;
        }
        await Promise.all([
            StorageAPI.logout(),
            new Promise<void>((res) => {
                setTimeout(() => {
                    res();
                }, 100);
            }),
        ]);
        localStorage.clear();
        sessionStorage.clear();
        location.reload();
    };
    return (
        <div className="flex items-center justify-between gap-2 px-8 py-4">
            <div className="flex-1 flex items-center gap-2 overflow-hidden">
                <img
                    src={avatar_url}
                    alt={`${id}`}
                    className="w-12 h-12 rounded-full border"
                />

                <div className="flex flex-col overflow-hidden">
                    <div className="flex">
                        <div className="font-semibold flex-1 truncate">
                            {name}
                        </div>
                        <div
                            className="px-2 flex-shrink-0"
                            title={`Signed with ${StorageAPI.name}`}
                        >
                            <div className="text-xs border rounded px-1">
                                {StorageAPI.name}
                            </div>
                        </div>
                    </div>
                    <div className="text-sm opacity-60">{id}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                {expired && (
                    <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                            StorageAPI.loginWith(StorageAPI.type);
                        }}
                    >
                        <i className="icon-[mdi--reload]"></i>
                        {t("re-login")}
                    </Button>
                )}
                <Button size="sm" variant="destructive" onClick={toLogOut}>
                    {t("logout")}
                </Button>
            </div>
        </div>
    );
}

export default function SettingsForm({
    onConfirm,
    onCancel,
}: {
    onConfirm?: (isEdit: boolean) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    return (
        <PopupLayout
            onBack={onCancel}
            title={t("settings")}
            className="h-full overflow-hidden"
        >
            <div className="divide-y divide-solid flex flex-col overflow-hidden">
                <UserInfo />
                <div className="flex-1 overflow-y-auto flex flex-col divide-y pb-4">
                    <BookSettings />
                    <CategorySettingsItem />
                    <TagSettingsItem />
                    <Budget />
                    <CurrencySettingsItem />
                    <UserSettingsItem />
                    <DataManagerSettingsItem />
                    <LabSettingsItem />
                    <AboutSettingsItem />
                    <ThemeSettingsItem />
                    <LanguageSettingsItem />
                </div>
            </div>
        </PopupLayout>
    );
}
