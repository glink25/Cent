import { useState } from "react";
import type { BillFilter } from "@/ledger/type";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import BillFilterForm from "./form";

export default BillFilterForm;

function BillFilterFormed({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: { filter: BillFilter; name?: string };
    onCancel?: () => void;
    onConfirm?: (v: "delete" | { filter: BillFilter; name?: string }) => void;
}) {
    const [form, setForm] = useState(edit?.filter ?? {});
    const [name, setName] = useState(edit?.name ?? "");
    const t = useIntl();
    return (
        <div className="flex flex-col p-4 gap-2">
            <label className="outline rounded px-2 py-1 w-fit">
                <input
                    className="w-min outline-none font-semibold text-lg"
                    value={name}
                    onChange={(e) => {
                        setName(e.currentTarget.value);
                    }}
                ></input>
                <i className="icon-[mdi--edit-outline]"></i>
            </label>
            <BillFilterForm
                form={form}
                setForm={setForm}
                className="text-xs md:text-sm"
            />
            <div className="w-full flex justify-between gap-2">
                <Button
                    variant="destructive"
                    onClick={() => {
                        const ok = confirm(
                            "Are you sure to delete this filter?",
                        );
                        if (!ok) {
                            return;
                        }
                        onConfirm?.("delete");
                    }}
                >
                    {t("delete")}
                </Button>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => onCancel?.()}>
                        {t("cancel")}
                    </Button>
                    <Button
                        onClick={() =>
                            onConfirm?.({
                                filter: form,
                                name: name || undefined,
                            })
                        }
                    >
                        {t("confirm")}
                    </Button>
                </div>
            </div>
        </div>
    );
}

export const [BillFilterProvider, showBillFilter] = createConfirmProvider(
    BillFilterFormed,
    {
        dialogTitle: "Edit Bill",
    },
);
