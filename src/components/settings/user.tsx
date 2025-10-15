import { useCreators } from "@/hooks/use-creator";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import createConfirmProvider from "../confirm";
import Deletable from "../deletable";
import { Button } from "../ui/button";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const { login, avatar_url, name: myName } = useUserStore();
    const { currentBookId } = useBookStore();
    const creators = useCreators();

    const toEditName = async (user: { login: string }) => {
        const newName = prompt("请输入自定义昵称");
        if (!newName) {
            return;
        }
        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            if (!prev.names) {
                prev.names = {};
            }
            prev.names[user.login] = newName;
            return prev;
        });
    };
    const toRecoverName = async (user: { login: string }) => {
        await useLedgerStore.getState().updatePersonalMeta((prev) => {
            if (!prev.names) {
                prev.names = {};
            }
            delete prev.names[user.login];
            return prev;
        });
    };
    return (
        <PopupLayout
            title={t("user-management")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="px-4 opacity-60 text-sm">{t("me")}</div>
            <div className="flex items-center justify-between gap-2 px-4 py-2 border-b">
                <div className="flex items-center gap-2">
                    <img
                        src={avatar_url}
                        alt={myName}
                        className="w-12 h-12 rounded-full border"
                    />

                    <div>
                        <div className="font-semibold">{myName}</div>
                        <div className="text-sm opacity-60">{login}</div>
                    </div>
                </div>
            </div>
            <div className="px-4 opacity-60 text-sm pt-2">
                {t("collaborators")}
            </div>
            <div className="divide-y divide-solid flex flex-col overflow-hidden gap-2">
                {creators
                    .filter((u) => u.login !== login)
                    .map((user) => {
                        return (
                            <div
                                key={user.login}
                                className="flex items-center justify-between gap-2 px-4 py-2"
                            >
                                <div className="flex items-center gap-2">
                                    <img
                                        src={user.avatar_url}
                                        alt={user.name}
                                        className="w-12 h-12 rounded-full border"
                                    />

                                    <div>
                                        {user.name !== user.originalName ? (
                                            <Deletable
                                                className="[&_.delete-button]:bg-stone-800"
                                                onDelete={() => {
                                                    toRecoverName(user);
                                                }}
                                                icon={
                                                    <i className="icon-[mdi--reload] text-white size-3"></i>
                                                }
                                            >
                                                <div className="font-semibold">
                                                    {user.name}
                                                </div>
                                            </Deletable>
                                        ) : (
                                            <div className="font-semibold">
                                                {user.name}
                                            </div>
                                        )}
                                        <div className="text-sm opacity-60">
                                            {user.login}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        size={"sm"}
                                        variant={"secondary"}
                                        onClick={() => {
                                            toEditName(user);
                                        }}
                                    >
                                        <i className="icon-[mdi--pencil]" />
                                    </Button>
                                    <Button size={"sm"} asChild>
                                        <a
                                            href={`https://github.com/${currentBookId}/settings/access`}
                                            target="_blank"
                                        >
                                            <i className="icon-[mdi--settings]" />
                                        </a>
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
            </div>
        </PopupLayout>
    );
}

const [UserSettingsProvider, showUserSettings] = createConfirmProvider(Form, {
    dialogTitle: "user-management",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full data-[state=open]:animate-slide-from-right rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px] sm:data-[state=open]:animate-content-show",
});

export default function UserSettingsItem() {
    const t = useIntl();
    return (
        <div className="lab">
            <Button
                onClick={() => {
                    showUserSettings();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--account-supervisor-outline] size-5"></i>
                        {t("user-management")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <UserSettingsProvider />
        </div>
    );
}
