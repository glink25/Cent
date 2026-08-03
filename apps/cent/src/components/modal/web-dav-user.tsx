import { useState } from "react";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";

export type WebDAVUserSelection =
    | { type: "existing"; userId: string }
    | { type: "new" };

export type WebDAVUserSelectOptions = {
    userIds: string[];
};

const NEW_USER = "__new_webdav_user__";

const WebDAVUserSelectForm = ({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: WebDAVUserSelectOptions;
    onCancel?: () => void;
    onConfirm?: (selection: WebDAVUserSelection) => void;
}) => {
    const t = useIntl();
    const [selected, setSelected] = useState(edit?.userIds[0] ?? NEW_USER);

    return (
        <div className="flex flex-col gap-4 p-4">
            <div className="font-medium">{t("web-dav-select-user")}</div>
            <select
                className="h-9 rounded-md border bg-background px-3 text-sm"
                value={selected}
                onChange={(event) => setSelected(event.target.value)}
            >
                {edit?.userIds.map((userId) => (
                    <option key={userId} value={userId}>
                        {userId}
                    </option>
                ))}
                <option value={NEW_USER}>{t("web-dav-create-user")}</option>
            </select>

            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onCancel}>
                    {t("cancel")}
                </Button>
                <Button
                    onClick={() =>
                        onConfirm?.(
                            selected === NEW_USER
                                ? { type: "new" }
                                : { type: "existing", userId: selected },
                        )
                    }
                >
                    {t("confirm")}
                </Button>
            </div>
        </div>
    );
};

export const [WebDAVUserSelectProvider, showWebDAVUserSelect] =
    createConfirmProvider<WebDAVUserSelectOptions, WebDAVUserSelection>(
        WebDAVUserSelectForm,
        {
            dialogTitle: "web-dav-select-user",
            dialogModalClose: false,
            contentClassName: "w-[360px] h-fit",
            fade: true,
        },
    );
