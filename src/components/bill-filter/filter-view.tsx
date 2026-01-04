import { useState } from "react";
import { DefaultCurrencyId } from "@/api/currency/currencies";
import { useCurrency } from "@/hooks/use-currency";
import type { BillFilter } from "@/ledger/type";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import BillFilterForm from "./form";

export default function BillFilterView({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: {
        filter: BillFilter;
        name?: string;
        displayCurrency?: string;
        hideDelete?: boolean;
    };
    onCancel?: () => void;
    onConfirm?: (
        v:
            | "delete"
            | { filter: BillFilter; name?: string; displayCurrency?: string },
    ) => void;
}) {
    const { baseCurrency } = useCurrency();
    const [form, setForm] = useState(
        edit?.filter ?? { baseCurrency: baseCurrency.id },
    );
    const [name, setName] = useState(edit?.name ?? "");
    const [displayCurrency, setDisplayCurrency] = useState(
        edit?.displayCurrency ?? DefaultCurrencyId,
    );
    const t = useIntl();

    const { quickCurrencies } = useCurrency();
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
                    showComment
                />
                <div className="text-xs opacity-60 pb-2">
                    {t("stat-view-settings")}
                </div>
                <div className="text-xs md:text-sm flex justify-between items-center">
                    <div>
                        <Popover>
                            <PopoverTrigger>
                                <div className="flex gap-1 items-center">
                                    <div>{t("display-currency")}</div>
                                    <i className="icon-[mdi--question-mark-circle-outline]" />
                                </div>
                            </PopoverTrigger>
                            <PopoverContent side="bottom" className="p-1">
                                <div className="text-xs opacity-60">
                                    {t("display-currency-desc")}
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                    <Select
                        value={displayCurrency}
                        onValueChange={setDisplayCurrency}
                    >
                        <SelectTrigger>
                            <div>
                                {quickCurrencies.find(
                                    (c) => c.id === displayCurrency,
                                )?.label ?? t("base-currency")}
                            </div>
                        </SelectTrigger>
                        <SelectContent>
                            {quickCurrencies.length > 0 ? (
                                quickCurrencies.map(({ id, label }) => {
                                    return (
                                        <SelectItem key={id} value={id}>
                                            <div>{label}</div>
                                        </SelectItem>
                                    );
                                })
                            ) : (
                                <div className="text-sm opacity-60">
                                    {t("empty-currency-quick-entries")}
                                </div>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <div className="w-full px-4 flex justify-between gap-2">
                <div>
                    {!edit?.hideDelete && (
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
                    )}
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="ghost" onClick={() => onCancel?.()}>
                        {t("cancel")}
                    </Button>
                    <Button
                        onClick={() =>
                            onConfirm?.({
                                filter: form,
                                name: name || undefined,
                                displayCurrency,
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
