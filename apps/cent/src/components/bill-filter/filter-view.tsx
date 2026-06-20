import { Collapsible } from "radix-ui";
import { useMemo, useState } from "react";
import { DefaultCurrencyId } from "@/api/currency/currencies";
import { useCurrency } from "@/hooks/use-currency";
import { useWidget } from "@/hooks/use-widget";
import type { BillFilterViewModule } from "@/ledger/extra-type";
import type { BillFilter } from "@/ledger/type";
import { useIntl } from "@/locale";
import modal from "../modal";
import {
    type SortableEnableItem,
    showSortableAndEnable,
} from "../sortable/enable";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import BillFilterForm from "./form";

const BuiltInModules: { id: BillFilterViewModule; nameKey: string }[] = [
    { id: "base-analysis", nameKey: "module-base-analysis" },
    { id: "top-words", nameKey: "module-top-words" },
    { id: "map", nameKey: "module-map" },
    { id: "analysis", nameKey: "module-analysis" },
    { id: "top-expense", nameKey: "module-top-expense" },
    { id: "top-income", nameKey: "module-top-income" },
];

export default function BillFilterView({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: {
        filter: BillFilter;
        name?: string;
        displayCurrency?: string;
        modules?: BillFilterViewModule[];
        hideDelete?: boolean;
    };
    onCancel?: () => void;
    onConfirm?: (
        v:
            | "delete"
            | {
                  filter: BillFilter;
                  name?: string;
                  displayCurrency?: string;
                  modules?: BillFilterViewModule[];
              },
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
    const [modules, setModules] = useState<BillFilterViewModule[] | undefined>(
        edit?.modules,
    );
    const t = useIntl();
    const { widgets } = useWidget();

    const { quickCurrencies } = useCurrency();

    const handleModuleConfig = async () => {
        const hasModules = modules !== undefined;
        const items: SortableEnableItem[] = [];
        const addedIds = new Set<string>();

        if (hasModules && modules.length > 0) {
            modules.forEach((moduleId) => {
                const builtIn = BuiltInModules.find((m) => m.id === moduleId);
                if (builtIn) {
                    items.push({
                        id: builtIn.id,
                        name: t(builtIn.nameKey),
                        enable: true,
                        freeze: builtIn.id === "base-analysis",
                    });
                    addedIds.add(builtIn.id);
                } else if (
                    typeof moduleId === "string" &&
                    moduleId.startsWith("widget-")
                ) {
                    const widgetId = moduleId.slice(7);
                    const widget = widgets.find((w) => w.id === widgetId);
                    if (widget) {
                        items.push({
                            id: moduleId,
                            name: widget.name,
                            enable: true,
                        });
                        addedIds.add(moduleId);
                    }
                }
            });
        }

        BuiltInModules.forEach((builtIn) => {
            if (!addedIds.has(builtIn.id)) {
                items.push({
                    id: builtIn.id,
                    name: t(builtIn.nameKey),
                    enable: !hasModules,
                    freeze: builtIn.id === "base-analysis",
                });
                addedIds.add(builtIn.id);
            }
        });

        widgets.forEach((widget) => {
            const widgetModuleId =
                `widget-${widget.id}` as BillFilterViewModule;
            if (!addedIds.has(widgetModuleId)) {
                items.push({
                    id: widgetModuleId,
                    name: widget.name,
                    enable: false,
                });
            }
        });

        const result = await showSortableAndEnable(items);
        if (result && result.length > 0) {
            let enabledModules = result
                .filter((item) => item.enable)
                .map((item) => item.id as BillFilterViewModule);

            const hasBaseAnalysis = enabledModules.includes("base-analysis");
            if (!hasBaseAnalysis) {
                enabledModules = ["base-analysis", ...enabledModules];
            }

            setModules(enabledModules.length > 0 ? enabledModules : undefined);
        }
    };

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
            <div className="flex-1 px-2 pb-4 overflow-y-auto">
                <Collapsible.Root defaultOpen className="group">
                    <Collapsible.Trigger className="w-full flex items-center justify-between text-xs opacity-60 pb-2">
                        <div>{t("stat-filter-settings")}</div>
                        <i className="group-[[data-state=open]]:icon-[mdi--chevron-down] group-[[data-state=closed]]:icon-[mdi--chevron-up] !size-4" />
                    </Collapsible.Trigger>
                    <Collapsible.Content className="data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
                        <BillFilterForm
                            form={form}
                            setForm={setForm}
                            className="text-xs md:text-sm border-none"
                            showComment
                        />
                    </Collapsible.Content>
                </Collapsible.Root>
                <Collapsible.Root defaultOpen className="group">
                    <Collapsible.Trigger className="w-full flex items-center justify-between text-xs opacity-60 pb-2 pt-2">
                        <div>{t("stat-view-settings")}</div>
                        <i className="group-[[data-state=open]]:icon-[mdi--chevron-down] group-[[data-state=closed]]:icon-[mdi--chevron-up] !size-4" />
                    </Collapsible.Trigger>
                    <Collapsible.Content className="data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
                        <div className="text-xs md:text-sm flex justify-between items-center">
                            <div>
                                <Popover>
                                    <PopoverTrigger>
                                        <div className="flex gap-1 items-center">
                                            <div>{t("display-currency")}</div>
                                            <i className="icon-[mdi--question-mark-circle-outline]" />
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent
                                        side="bottom"
                                        className="p-1"
                                    >
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
                        <div className="text-xs md:text-sm flex justify-between items-center mt-2">
                            <div>{t("custom-modules")}</div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleModuleConfig}
                            >
                                <i className="icon-[mdi--menu] mr-1" />
                                {t("configure")}
                            </Button>
                        </div>
                    </Collapsible.Content>
                </Collapsible.Root>
            </div>
            <div className="w-full px-4 flex justify-between gap-2">
                <div>
                    {!edit?.hideDelete && (
                        <Button
                            variant="destructive"
                            onClick={async () => {
                                await modal.prompt({
                                    title: t(
                                        "are-you-sure-to-delete-this-filter",
                                    ),
                                });
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
                                modules,
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
