import { useCallback, useState } from "react";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { type SortableItem, SortableList } from "./list";

export default function Form<T extends SortableItem>({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: T[];
    onConfirm?: (v: T[]) => void;
    onCancel?: () => void;
}) {
    const [list, setList] = useState([...(edit ?? [])]);
    const onReorder: typeof setList = useCallback((v) => {
        setList(v);
    }, []);
    const t = useIntl();
    return (
        <PopupLayout
            title={t("sort")}
            onBack={onCancel}
            right={
                <Button
                    onClick={() => {
                        onConfirm?.(list);
                    }}
                >
                    {t("confirm")}
                </Button>
            }
            className="h-full overflow-hidden"
        >
            <div className="flex-1 w-full overflow-hidden py-2">
                <SortableList
                    items={list}
                    onReorder={onReorder}
                    className="h-full max-h-full px-2"
                />
            </div>
        </PopupLayout>
    );
}
