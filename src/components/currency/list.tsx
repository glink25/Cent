/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { type Currency, DefaultCurrencies } from "@/api/currency/currencies";
import { useCurrency } from "@/hooks/use-currency";
import PopupLayout from "@/layouts/popup-layout";
import type { CustomCurrency } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import modal from "../modal";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { EditCurrencyProvider, showEditCurrency } from "./edit-form";

export default function CurrencyListForm({
    edit,
    onCancel,
}: {
    edit?: any;
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

    const others = allCurrencies.filter((c) =>
        quickCurrencies.every((v) => v.id !== c.id),
    );

    /**
     * 判断是否为自定义货币类型 (CustomCurrency)
     */
    const isCustomCurrency = (
        v: CustomCurrency | Currency,
    ): v is CustomCurrency => {
        return customCurrencies.some((c) => c.id === v.id);
    };

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

    return (
        <PopupLayout
            onBack={onCancel}
            title={t("currency-manager")}
            className="flex flex-col h-full overflow-hidden"
            right={
                <div className="flex gap-2 items-center">
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
            <div className="flex-1 overflow-y-auto pb-4">
                <div className="border rounded-md px-2 mx-2 mb-4">
                    <div className="text-xs opacity-60 py-2">
                        {t("quick-currencies")}
                    </div>
                    <div>
                        {quickCurrencies.length === 0 ? (
                            <div className="text-center text-xs opacity-60 py-4">
                                {t("quick-entry-empty")}{" "}
                            </div>
                        ) : (
                            quickCurrencies.map((currency) => {
                                const tail = (
                                    <>
                                        <Button
                                            size={"sm"}
                                            variant="ghost"
                                            onClick={(e) => {
                                                e.preventDefault();
                                                e.stopPropagation();
                                                updateQuickCurrencies(
                                                    quickCurrencies
                                                        .filter(
                                                            (v) =>
                                                                v.id !==
                                                                currency.id,
                                                        )
                                                        .map((v) => v.id),
                                                );
                                            }}
                                        >
                                            <i className="icon-[mdi--close]"></i>
                                        </Button>
                                    </>
                                );
                                if (isCustomCurrency(currency)) {
                                    const rate = currency.rateToBase;
                                    return (
                                        <CurrencyItem
                                            key={currency.id}
                                            name={currency.name}
                                            symbol={currency.symbol}
                                            rate={rate}
                                            onClick={() =>
                                                toUpdateCurrency(currency)
                                            }
                                        >
                                            {tail}
                                        </CurrencyItem>
                                    );
                                }
                                const rate = rates.find(
                                    (r) => r.id === currency.id,
                                );
                                return (
                                    <CurrencyItem
                                        key={currency.id}
                                        name={t(currency.labelKey)}
                                        symbol={currency.symbol}
                                        icon={currency.icon}
                                        rate={rate?.predict}
                                        onClick={() =>
                                            toManuallyUpdate(currency)
                                        }
                                    >
                                        {tail}
                                    </CurrencyItem>
                                );
                            })
                        )}
                    </div>
                </div>
                <div className="border rounded-md px-2 mx-2">
                    <div className="text-xs opacity-60 py-2">
                        {t("other-currencies")}
                    </div>
                    <div>
                        {others.map((currency) => {
                            const tail = (
                                <>
                                    <Button
                                        size={"sm"}
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            updateQuickCurrencies([
                                                currency.id,
                                                ...quickCurrencies.map(
                                                    (v) => v.id,
                                                ),
                                            ]);
                                        }}
                                    >
                                        <i className="icon-[mdi--arrow-collapse-up]"></i>
                                    </Button>
                                </>
                            );
                            if (isCustomCurrency(currency)) {
                                const rate = currency.rateToBase;
                                return (
                                    <CurrencyItem
                                        key={currency.id}
                                        name={currency.name}
                                        symbol={currency.symbol}
                                        rate={rate}
                                        onClick={() =>
                                            toUpdateCurrency(currency)
                                        }
                                    >
                                        {tail}
                                    </CurrencyItem>
                                );
                            }
                            const rate = rates.find(
                                (r) => r.id === currency.id,
                            );
                            return (
                                <CurrencyItem
                                    key={currency.id}
                                    name={t(currency.labelKey)}
                                    symbol={currency.symbol}
                                    icon={currency.icon}
                                    rate={rate?.predict}
                                    onClick={() => toManuallyUpdate(currency)}
                                >
                                    {tail}
                                </CurrencyItem>
                            );
                        })}
                    </div>
                </div>
            </div>
            <EditCurrencyProvider />
        </PopupLayout>
    );
}

function CurrencyItem({
    name,
    icon,
    symbol,
    rate,
    children,
    onClick,
}: {
    name: string;
    symbol: string;
    icon?: ReactNode;
    rate?: number;
    children?: ReactNode;
    onClick?: () => void;
}) {
    return (
        <div
            className="py-2 border-b w-full flex justify-between items-center cursor-pointer"
            onClick={onClick}
        >
            <div className="flex items-center gap-2">
                {icon && <div className="text-xl">{icon}</div>}
                <div className="text-left">
                    <div>{name}</div>
                    <div className="text-xs opacity-60">{`(${symbol})`}</div>
                </div>
            </div>
            <div className="flex items-center gap-2">
                <div className="text-sm">{rate?.toFixed(6)}</div>
                {children}
            </div>
        </div>
    );
}
