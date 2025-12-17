/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: <explanation> */
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { DefaultCurrencies } from "@/api/currency/currencies";
import { useCurrency } from "@/hooks/use-currency";
import PopupLayout from "@/layouts/popup-layout";
import type { CustomCurrency } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import modal from "../modal";
import { showSortableGroup } from "../sortable/group";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { EditCurrencyProvider, showEditCurrency } from "./edit";

export default function CurrencyListForm({
    edit,
    onCancel,
}: {
    edit?: { openQuickEntry?: boolean };
    onCancel?: () => void;
    onConfirm?: (v: any) => void;
}) {
    const t = useIntl();
    const {
        baseCurrency,
        setBaseCurrency,
        convert,
        setRate,
        refresh,

        customCurrencies,
        updateCustomCurrency,
        deleteCustomCurrency,

        allCurrencies,
        quickCurrencies,
        updateQuickCurrencies,
    } = useCurrency();

    const rates = useMemo(() => {
        return DefaultCurrencies.map((currency) => {
            return {
                ...convert(1, baseCurrency.id, currency.id),
                id: currency.id,
            };
        });
    }, [baseCurrency.id, convert]);

    const toManuallyUpdate = async (
        currency: (typeof DefaultCurrencies)[number],
    ) => {
        if (currency.id === baseCurrency.id) {
            return;
        }
        const rate = rates.find((r) => r.id === currency.id);
        if (!rate) {
            return;
        }
        const value = (await modal.prompt({
            title: (
                <div>
                    <h1>{t("manually-update-rate")}</h1>
                    <p className="text-xs opacity-60">
                        {t("manually-update-rate-desc")}
                    </p>
                </div>
            ),
            input: { type: "number", defaultValue: rate?.predict.toFixed(6) },
        })) as string | undefined;
        if (value === undefined || value === null || value === "") {
            setRate(currency.id, undefined);
            return;
        }
        const newRate = Number(value);
        if (newRate <= 0) {
            toast.error(t("rate-must-positive"));
            return;
        }
        setRate(currency.id, newRate);
    };

    const [loading, setLoading] = useState(false);
    const toRefresh = async () => {
        setLoading(true);
        try {
            await refresh();
            toast.success(t("rate-update-success"));
        } finally {
            setLoading(false);
        }
    };

    const toUpdateCurrency = async (currency?: CustomCurrency) => {
        const newCurrency = await showEditCurrency(currency);
        if (!newCurrency) {
            return;
        }
        if (typeof newCurrency === "string") {
            if (currency?.id) {
                deleteCustomCurrency(currency.id);
            }
            return;
        }
        updateCustomCurrency(newCurrency);
    };

    const toReOrder = async () => {
        const others = allCurrencies.filter((c) =>
            quickCurrencies.every((v) => v.id !== c.id),
        );
        const group = [
            {
                id: "quick",
                label: `${t("quick-currencies")}`,
                items: quickCurrencies.map((c) => ({
                    id: c.id,
                    label: c.label,
                })),
                empty: t("quick-entry-empty"),
            },
            {
                id: "others",
                label: t("Other"),
                items: others.map((c) => ({
                    id: c.id,
                    label: c.label,
                })),
            },
        ];
        const newOrder = await showSortableGroup({ group });
        const newQuickItems =
            newOrder.find((v) => v.id === "quick")?.items ?? [];
        updateQuickCurrencies(newQuickItems.map((v) => v.id));
    };

    const toReorderRef = useRef(toReOrder);
    toReorderRef.current = toReOrder;
    useEffect(() => {
        if (edit?.openQuickEntry) {
            toReorderRef.current();
        }
    }, [edit?.openQuickEntry]);
    return (
        <PopupLayout
            onBack={onCancel}
            title={t("currency-manager")}
            className="flex flex-col h-full overflow-hidden"
            right={
                <div className="flex gap-2 items-center">
                    <Button variant="secondary" onClick={toReOrder}>
                        {t("quick-currencies")}
                    </Button>
                    <Button onClick={() => toUpdateCurrency()}>
                        <i className="icon-[mdi--add]"></i>
                    </Button>
                </div>
            }
        >
            <div className="flex justify-between px-4 border-b py-4">
                <Popover>
                    <PopoverTrigger>
                        <div className="flex items-center gap-1">
                            {t("base-currency")}
                            <i className="icon-[mdi--question-mark-circle-outline]"></i>
                        </div>
                    </PopoverTrigger>
                    <PopoverContent>
                        <div
                            className="text-sm [&>div]:text-xs [&>div]:opacity-60 [&>div]:py-2"
                            dangerouslySetInnerHTML={{
                                __html: t("currency_change_warning"),
                            }}
                        ></div>
                    </PopoverContent>
                </Popover>
                <Select value={baseCurrency.id} onValueChange={setBaseCurrency}>
                    <SelectTrigger className="w-fit">
                        <div>{baseCurrency.label}</div>
                    </SelectTrigger>
                    <SelectContent>
                        {DefaultCurrencies.map((currency) => {
                            return (
                                <SelectItem
                                    key={currency.id}
                                    value={currency.id}
                                >
                                    {t(currency.labelKey)}
                                </SelectItem>
                            );
                        })}
                    </SelectContent>
                </Select>
            </div>
            <div className="w-full px-6 flex justify-between py-1">
                <div className="text-xs opacity-60">{t("currency")}</div>
                <div className="text-xs opacity-60 flex items-center gap-2">
                    <Popover>
                        <PopoverTrigger>
                            <div className="flex items-center gap-1">
                                {t("exchange-rate")}
                                <i className="icon-[mdi--question-mark-circle-outline]"></i>
                            </div>
                        </PopoverTrigger>
                        <PopoverContent className="p-2 text-xs w-fit">
                            <div>
                                {t("exchange-rate-from", {
                                    a: (
                                        <a
                                            className="underline"
                                            href="https://ecb.europa.eu"
                                            target="_blank"
                                            rel="noopener"
                                        >
                                            ecb.europa.eu
                                        </a>
                                    ),
                                })}
                            </div>
                        </PopoverContent>
                    </Popover>
                    <Button
                        className="p-0 h-fit"
                        disabled={loading}
                        onClick={toRefresh}
                    >
                        <i
                            className={cn(
                                "icon-[mdi--refresh]",
                                loading && "animate-spin",
                            )}
                        ></i>
                    </Button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto">
                <div className="px-4">
                    {customCurrencies.map((currency) => {
                        const rate = currency.rateToBase;
                        return (
                            <button
                                key={currency.id}
                                type="button"
                                className="py-2 border-b w-full flex justify-between items-center cursor-pointer"
                                onClick={() => toUpdateCurrency(currency)}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="text-xl"></div>
                                    <div className="text-left">
                                        <div>{currency.name}</div>
                                        <div className="text-xs opacity-60">
                                            {`(${currency.symbol})`}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm">{rate.toFixed(6)}</div>
                            </button>
                        );
                    })}
                </div>
                <div className="px-4">
                    {DefaultCurrencies.map((currency) => {
                        const rate = rates.find((r) => r.id === currency.id);
                        return (
                            <button
                                key={currency.id}
                                type="button"
                                disabled={currency.id === baseCurrency.id}
                                className="py-2 border-b w-full flex justify-between items-center"
                                onClick={() => toManuallyUpdate(currency)}
                            >
                                <div className="flex items-center gap-2">
                                    <div className="text-xl">
                                        {currency.icon}
                                    </div>
                                    <div className="text-left">
                                        <div>{t(currency.labelKey)}</div>
                                        <div className="text-xs opacity-60">
                                            {currency.id}
                                            {`(${currency.symbol})`}
                                        </div>
                                    </div>
                                </div>
                                <div className="text-sm">
                                    {rate?.predict.toFixed(6)}
                                </div>
                            </button>
                        );
                    })}
                </div>
            </div>
            <EditCurrencyProvider />
        </PopupLayout>
    );
}
