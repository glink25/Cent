import { type Dispatch, type SetStateAction, useMemo } from "react";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useCurrency } from "@/hooks/use-currency";
import { useTag } from "@/hooks/use-tag";
import type { BillCategory, BillFilter, BillType } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { CascadeMultipleSelect } from "../cascade";
import Clearable from "../clearable";
import { DatePicker } from "../date-picker";
import Tag from "../tag";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Input } from "../ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

export default function BillFilterForm({
    form,
    setForm,
    className,
    showComment,
}: {
    form: BillFilter;
    setForm: Dispatch<SetStateAction<BillFilter>>;
    className?: string;
    /** 是否展示备注输入表单 */
    showComment?: boolean;
}) {
    const t = useIntl();
    const dateType = form.recent === undefined ? "date" : "recent";

    const setTime = (v: number | undefined, type: "start" | "end") => {
        setForm((prev) => {
            if (type === "start") {
                const pair =
                    v === undefined
                        ? [v, prev.end]
                        : v > (prev.end ?? Infinity)
                          ? [prev.end, v]
                          : [v, prev.end];
                return { ...prev, start: pair[0], end: pair[1] };
            }
            const pair =
                v === undefined
                    ? [prev.start, v]
                    : v > (prev.start ?? -Infinity)
                      ? [prev.start, v]
                      : [v, prev.start];
            return { ...prev, start: pair[0], end: pair[1] };
        });
    };

    const formatForm = () => {};

    const allCreators = useCreators();
    const { incomes, expenses, categories: allCategories } = useCategory();
    const options = useMemo(
        () => [
            {
                id: "ExpensesLabel",
                asGroupLabel: t("expense"),
                name: "",
            },
            ...expenses,
            {
                id: "IncomesLabel",
                asGroupLabel: t("income"),
                name: "",
            },
            ...incomes,

            // { id: "EXPENSE_SELECT", name: "expense", children: expenses },
            // { id: "INCOME_SELECT", name: "income", children: incomes },
        ],
        [expenses, incomes, t],
    );
    const categories = allCategories
        .filter((cate) =>
            form.type === undefined ? true : cate.type === form.type,
        )
        .reduce(
            (p, c) => {
                const found = p.find((v) => v.type === c.type);
                if (found) {
                    found.list.push(c);
                    return p;
                }
                p.push({ type: c.type, list: [c] });
                return p;
            },
            [] as { type: BillType; list: BillCategory[] }[],
        );

    const formatCategories = (ids?: string[]) => {
        if (ids === undefined || ids.length === 0) {
            return t("unlimited");
        }
        if (ids.length === categories.reduce((p, c) => p + c.list.length, 0)) {
            return t("all");
        }
        return ids
            .map((id) => allCategories.find((v) => v.id === id)?.name ?? id)
            .join(",");
    };

    const formatCreators = (ids?: (number | string)[]) => {
        if (ids === undefined || ids.length === 0) {
            return t("unlimited");
        }
        if (ids.length === allCreators.length) {
            return t("all");
        }
        return ids
            .map((id) => allCreators.find((v) => v.id === id)?.name ?? id)
            .join(",");
    };

    const { tags: allTags } = useTag();
    const formatTags = (ids?: (number | string)[]) => {
        if (ids === undefined || ids.length === 0) {
            return t("unlimited");
        }
        return ids
            .map((id) => allTags.find((v) => v.id === id)?.name ?? id)
            .join(",");
    };

    const { allCurrencies } = useCurrency();
    const formatCurrencies = (ids?: (number | string)[]) => {
        if (ids === undefined || ids.length === 0) {
            return t("unlimited");
        }
        return ids
            .map((id) => allCurrencies.find((v) => v.id === id)!.label)
            .join(",");
    };
    return (
        <div className={cn("flex flex-col gap-3 border-b", className)}>
            {/* time selector */}
            <div className="flex justify-between items-center gap-2">
                <Select
                    value={dateType}
                    onValueChange={(v) => {
                        if (v === "recent") {
                            setForm((prev) => ({
                                ...prev,
                                recent: { value: 1, unit: "month" },
                            }));
                            return;
                        }
                        setForm((prev) => ({ ...prev, recent: undefined }));
                    }}
                >
                    <SelectTrigger className="w-fit px-2 py-2 md:px-4 text-xs md:text-sm">
                        <SelectValue></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="date">{t("as-date")}</SelectItem>
                        <SelectItem value="recent">{t("recent")}</SelectItem>
                    </SelectContent>
                </Select>
                {dateType === "date" ? (
                    <div className="flex justify-between items-center">
                        <DateInput
                            value={form.start}
                            type="start"
                            onChange={(v) =>
                                setForm((prev) => ({ ...prev, start: v }))
                            }
                            onBlur={formatForm}
                        />
                        <div className="px-1"> - </div>
                        <DateInput
                            value={form.end}
                            type="end"
                            onChange={(v) =>
                                setForm((prev) => ({ ...prev, end: v }))
                            }
                            onBlur={formatForm}
                        />
                    </div>
                ) : (
                    <div className="flex justify-between items-center gap-2">
                        <RangeInput
                            value={form.recent?.value}
                            onChange={(v) => {
                                if (v === undefined) {
                                    return;
                                }
                                setForm((prev) => ({
                                    ...prev,
                                    recent: {
                                        unit: prev.recent?.unit ?? "week",
                                        value: v,
                                    },
                                }));
                            }}
                        />
                        <Select
                            value={form.recent?.unit ?? "day"}
                            onValueChange={(v) => {
                                setForm((prev) => ({
                                    ...prev,
                                    recent: {
                                        value: prev.recent?.value ?? 1,
                                        unit: v as any,
                                    },
                                }));
                            }}
                        >
                            <SelectTrigger className="w-20 px-2 py-2 md:px-4 text-xs md:text-sm">
                                <SelectValue></SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="day">
                                    {t("unit-day")}
                                </SelectItem>
                                <SelectItem value="week">
                                    {t("unit-week")}
                                </SelectItem>
                                <SelectItem value="month">
                                    {t("month")}
                                </SelectItem>
                                <SelectItem value="year">
                                    {t("year")}
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </div>
            {/* comment */}
            {showComment && (
                <div className="w-full flex justify-between items-center">
                    <div className="flex items-center gap-1">
                        <i className="icon-[mdi--comment-processing-outline]"></i>
                        {t("comment")}:
                    </div>
                    <div>
                        <Input
                            className="text-right"
                            value={form.comment ?? ""}
                            onChange={(e) => {
                                const value = e.target.value;
                                setForm((v) => ({ ...v, comment: value }));
                            }}
                        />
                    </div>
                </div>
            )}
            {/* type selector */}
            <div className="w-full flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <i className="icon-[mdi--arrow-collapse]"></i>
                    {t("type")}:
                </div>
                <div className="flex items-center rounded-md shadow border border-input overflow-hidden divide-x">
                    <button
                        type="button"
                        className={`w-20 flex items-center justify-center pr-2 md:pl-4 py-2 h-[34px] buttoned cursor-pointer transition-colors duration-200 ${
                            form.type === "income"
                                ? "!bg-stone-700 !text-white"
                                : ""
                        }`}
                        onClick={() =>
                            setForm((v) => ({ ...v, type: "income" }))
                        }
                    >
                        {t("income")}
                    </button>
                    <button
                        type="button"
                        className={`w-20 flex items-center justify-center py-2 h-[34px] buttoned cursor-pointer transition-colors duration-200 ${
                            form.type === "expense"
                                ? "!bg-stone-700 !text-white"
                                : ""
                        }`}
                        onClick={() =>
                            setForm((v) => ({ ...v, type: "expense" }))
                        }
                    >
                        {t("expense")}
                    </button>
                    <button
                        type="button"
                        className={`w-20 flex items-center justify-center pr-2 md:pr-4 py-2 h-[34px] buttoned cursor-pointer transition-colors duration-200 ${
                            form.type === undefined
                                ? "!bg-stone-700 !text-white"
                                : ""
                        }`}
                        onClick={() =>
                            setForm((v) => ({ ...v, type: undefined }))
                        }
                    >
                        {t("all")}
                    </button>
                </div>
            </div>
            {/* amount range */}
            <div className="w-full flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <i className="icon-[mdi--scale-unbalanced]"></i>
                    {t("amount")}:
                </div>
                <div className="flex items-center gap-4">
                    <RangeInput
                        value={form.minAmountNumber}
                        onChange={(v) =>
                            setForm((prev) => ({ ...prev, minAmountNumber: v }))
                        }
                        onBlur={formatForm}
                    />
                    <div> - </div>
                    <RangeInput
                        value={form.maxAmountNumber}
                        onChange={(v) =>
                            setForm((prev) => ({ ...prev, maxAmountNumber: v }))
                        }
                        onBlur={formatForm}
                    />
                </div>
            </div>
            {/* category selector */}
            <div className="w-full flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <i className="icon-[mdi--category-plus-outline]"></i>
                    {t("categories")}:
                </div>
                <CascadeMultipleSelect
                    value={form.categories ?? allCategories.map((c) => c.id)}
                    list={options}
                    align="end"
                    trigger={
                        <Button
                            variant="outline"
                            className="px-2 md:px-4 py-2 text-xs md:text-sm"
                        >
                            <div className="truncate max-w-[200px]">
                                {formatCategories(form.categories)}
                            </div>
                        </Button>
                    }
                    onValueChange={(value) => {
                        setForm((prev) => {
                            return {
                                ...prev,
                                categories: value,
                            };
                        });
                    }}
                ></CascadeMultipleSelect>
            </div>
            {/* currency selector */}
            <div className="w-full flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <i className="icon-[mdi--currency-eur]"></i>
                    {t("currency")}:
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="px-2 md:px-4 py-2 text-xs md:text-sm"
                        >
                            <div className="max-w-[120px] truncate">
                                {formatCurrencies(form.currencies)}
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                        {allCurrencies.map((item) => (
                            <DropdownMenuCheckboxItem
                                key={item.id}
                                checked={
                                    form.currencies
                                        ? form.currencies.includes(item.id)
                                        : false
                                }
                                onCheckedChange={(v) => {
                                    setForm((prev) => {
                                        const set = new Set(
                                            prev.currencies ?? [],
                                        );
                                        if (v) {
                                            set.add(item.id);
                                        } else {
                                            set.delete(item.id);
                                        }
                                        const newCurrencies = Array.from(set);
                                        return {
                                            ...prev,
                                            currencies: newCurrencies,
                                        };
                                    });
                                }}
                            >
                                {item.label}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {/* user selector */}
            <div className="w-full flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <i className="icon-[mdi--user-details-outline]"></i>
                    {t("users")}:
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="px-2 md:px-4 py-2 text-xs md:text-sm"
                        >
                            <div className="max-w-[120px] truncate">
                                {formatCreators(form.creators)}
                            </div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                        {/* <DropdownMenuLabel>Appearance</DropdownMenuLabel>
										<DropdownMenuSeparator /> */}
                        {allCreators.map((item) => (
                            <DropdownMenuCheckboxItem
                                key={item.id}
                                checked={
                                    form.creators
                                        ? form.creators.includes(item.id)
                                        : true
                                }
                                onCheckedChange={(v) => {
                                    setForm((prev) => {
                                        const set = new Set(
                                            prev.creators ??
                                                allCreators.map((c) => c.id),
                                        );
                                        if (v) {
                                            set.add(item.id);
                                        } else {
                                            set.delete(item.id);
                                        }
                                        const newCreators =
                                            set.size === 0
                                                ? prev.creators
                                                : Array.from(set);
                                        return {
                                            ...prev,
                                            creators: newCreators,
                                        };
                                    });
                                }}
                            >
                                {item.name}
                            </DropdownMenuCheckboxItem>
                        ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            {/* tags selector */}
            <div className="w-full flex justify-between items-center gap-2 overflow-hidden">
                <div className="flex items-center gap-1 flex-shrink-0">
                    <i className="icon-[mdi--tag-outline]"></i>
                    {t("tags")}:
                </div>
                <div className="flex items-center gap-4 overflow-y-auto scrollbar-hidden">
                    <div className="flex items-center gap-2">
                        <div className="flex-shrink-0">
                            {t("tags-excluded-short")}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="px-2 md:px-4 py-2 text-xs md:text-sm"
                                >
                                    <div className="max-w-[120px] truncate">
                                        {formatTags(form.excludeTags)}
                                    </div>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                {allTags.map((item) => (
                                    <DropdownMenuCheckboxItem
                                        key={item.id}
                                        checked={form.excludeTags?.includes(
                                            item.id,
                                        )}
                                        onCheckedChange={(v) => {
                                            setForm((prev) => {
                                                const set = new Set(
                                                    prev.excludeTags ?? [],
                                                );
                                                if (v) {
                                                    set.add(item.id);
                                                } else {
                                                    set.delete(item.id);
                                                }
                                                const newTags = Array.from(set);
                                                return {
                                                    ...prev,
                                                    excludeTags: newTags,
                                                };
                                            });
                                        }}
                                    >
                                        {item.name}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex-shrink-0">
                            {t("tags-include-short")}
                        </div>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    className="px-2 md:px-4 py-2 text-xs md:text-sm"
                                >
                                    <div className="max-w-[120px] truncate">
                                        {formatTags(form.tags)}
                                    </div>
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent className="w-56" align="end">
                                {allTags.map((item) => (
                                    <DropdownMenuCheckboxItem
                                        key={item.id}
                                        checked={
                                            form.tags
                                                ? form.tags.includes(item.id)
                                                : true
                                        }
                                        onCheckedChange={(v) => {
                                            setForm((prev) => {
                                                const set = new Set(
                                                    prev.tags ??
                                                        allTags.map(
                                                            (c) => c.id,
                                                        ),
                                                );
                                                if (v) {
                                                    set.add(item.id);
                                                } else {
                                                    set.delete(item.id);
                                                }
                                                const newTags = Array.from(set);
                                                return {
                                                    ...prev,
                                                    tags: newTags,
                                                };
                                            });
                                        }}
                                    >
                                        {item.name}
                                    </DropdownMenuCheckboxItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>
            </div>
            {/* other checkboxes */}
            <div className="w-full flex justify-between items-center">
                <div className="flex items-center gap-1">
                    <i className="icon-[mdi--archive-outline]"></i>
                    {t("others")}:
                </div>
                <div className="flex-1 flex justify-end overflow-y-scroll gap-3 py-1">
                    <Tag
                        checked={form.scheduled}
                        onCheckedChange={(v) => {
                            setForm((prev) => ({ ...prev, scheduled: v }));
                        }}
                        className="text-xs bg-transparent shadow-md"
                    >
                        {t("by-scheduled")}
                    </Tag>
                    <Tag
                        checked={form.assets}
                        onCheckedChange={(v) => {
                            setForm((prev) => ({ ...prev, assets: v }));
                        }}
                        className="text-xs bg-transparent shadow-md"
                    >
                        {t("with-assets")}
                    </Tag>
                </div>
            </div>
            {/* placeholder */}
            <div className="h-2"></div>
        </div>
    );
}

function RangeInput({
    value,
    onChange,
    onBlur,
}: {
    value: number | undefined;
    onChange?: (v?: number) => void;
    onBlur?: () => void;
}) {
    const t = useIntl();
    return (
        <Clearable
            visible
            className="relative rounded-md shadow px-2 py-2 md:px-4 border border-input truncate cursor-pointer hover:text-accent-foreground group range-input"
            onClear={() => onChange?.(undefined)}
        >
            {value === undefined && (
                <span className="absolute pointer-events-none group-[.range-input:focus-within]:hidden pr-4">
                    {t("unlimited")}
                </span>
            )}
            <input
                type="number"
                className="max-w-[64px] h-[18px] bg-transparent outline-none text-right"
                value={value ?? ""}
                onChange={(e) => {
                    onChange?.(Number(e.target.value));
                }}
                onBlur={onBlur}
            ></input>
        </Clearable>
    );
}

export function DateInput({
    value,
    onChange,
    onBlur,
    type,
}: {
    value: number | undefined;
    onChange?: (v?: number) => void;
    onBlur?: () => void;
    type: "start" | "end";
}) {
    const t = useIntl();
    return (
        <Clearable
            visible
            className="rounded-md shadow px-2 py-2 md:px-4 border border-input truncate cursor-pointer hover:text-accent-foreground"
            onClear={() => onChange?.(undefined)}
        >
            <DatePicker
                value={value}
                displayFormatter={(v) =>
                    v === undefined
                        ? type === "start"
                            ? t("from-oldest")
                            : t("to-newest")
                        : `${v.format("YY/MM/DD")}`
                }
                onChange={(e) => onChange?.(e)}
                onBlur={onBlur}
            />
        </Clearable>
    );
}
