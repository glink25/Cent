import { useState } from "react";
import { useCurrency } from "@/hooks/use-currency";
import type { BillFilter } from "@/ledger/type";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import BillFilterForm from "./form";

export default BillFilterForm;

function BillFilterView({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: { filter: BillFilter; name?: string };
    onCancel?: () => void;
    onConfirm?: (v: "delete" | { filter: BillFilter; name?: string }) => void;
}) {
    const { baseCurrency } = useCurrency();
    const [form, setForm] = useState(
        edit?.filter ?? { baseCurrency: baseCurrency.id },
    );
    const [name, setName] = useState(edit?.name ?? "");
    const t = useIntl();
    return (
        <div className="flex flex-col p-2 gap-2 h-[55vh] overflow-hidden">
            <label className="outline rounded px-4 py-1 w-fit">
                <input
                    className="w-min outline-none font-semibold text-lg"
                    value={name}
                    onChange={(e) => {
                        setName(e.currentTarget.value);
                    }}
                ></input>
                <i className="icon-[mdi--edit-outline]"></i>
            </label>
            <div className="flex-1 px-2 overflow-y-auto">
                <BillFilterForm
                    form={form}
                    setForm={setForm}
                    className="text-xs md:text-sm border-none"
                />
            </div>
            <div className="w-full px-4 flex justify-between gap-2">
                <Button
                    variant="destructive"
                    onClick={() => {
                        const ok = confirm(
                            t("are-you-sure-to-delete-this-filter"),
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

export const [BillFilterViewProvider, showBillFilterView] =
    createConfirmProvider(BillFilterView, {
        dialogTitle: "Edit Bill Filter",
        fade: true,
        swipe: false,
        contentClassName: "overflow-hidden",
    });
