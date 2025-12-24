import { Switch } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useCategory from "@/hooks/use-category";
import { useCurrency } from "@/hooks/use-currency";
import { useTag } from "@/hooks/use-tag";
import PopupLayout from "@/layouts/popup-layout";
import { amountToNumber, numberToAmount } from "@/ledger/bill";
import { ExpenseBillCategories, IncomeBillCategories } from "@/ledger/category";
import type { Bill } from "@/ledger/type";
import { categoriesGridClassName } from "@/ledger/utils";
import { useIntl, useLocale } from "@/locale";
import type { EditBill } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { cn } from "@/utils";
import { getPredictNow } from "@/utils/predict";
import { showTagList } from "../bill-tag";
import { showCategoryList } from "../category";
import { CategoryItem } from "../category/item";
import { DatePicker } from "../date-picker";
import Deletable from "../deletable";
import { FORMAT_IMAGE_SUPPORTED, showFilePicker } from "../file-picker";
import SmartImage from "../image";
import IOSUnscrolledInput from "../input";
import Calculator from "../keyboard";
import CurrentLocation from "../simple-location";
import Tag from "../tag";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { goAddBill } from ".";
import { RemarkHint } from "./remark";
import TagGroupSelector from "./tag-group";

const defaultBill = {
    type: "expense" as Bill["type"],
    comment: "",
    amount: 0,
    categoryId: ExpenseBillCategories[0].id,
};

export default function EditorForm({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: EditBill;
    onConfirm?: (v: Omit<Bill, "id" | "creatorId">) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const goBack = () => {
        onCancel?.();
    };

    const { baseCurrency, convert, quickCurrencies, allCurrencies } =
        useCurrency();

    const { incomes, expenses, categories: allCategories } = useCategory();

    const isCreate = edit === undefined;

    const predictCategory = useMemo(() => {
        // 只有新增账单时才展示预测
        if (!isCreate) {
            return;
        }
        const predict = getPredictNow();
        const pc = predict?.category?.[0];
        if (!pc) {
            return;
        }
        const category = allCategories.find((v) => v.id === pc);
        return category;
    }, [isCreate, allCategories]);

    const predictComments = useMemo(() => {
        // 只有新增账单时才展示预测
        if (!isCreate) {
            return;
        }
        const predict = getPredictNow();
        const pc = predict?.comment;
        return pc;
    }, [isCreate]);

    const [billState, setBillState] = useState(() => {
        const init = {
            ...defaultBill,
            categoryId: predictCategory?.id ?? defaultBill.categoryId,
            time: Date.now(),
            ...edit,
        };
        if (edit?.currency?.target === baseCurrency.id) {
            delete init.currency;
        }
        return init;
    });

    const { grouped } = useTag();

    const categories = billState.type === "expense" ? expenses : incomes;

    const subCategories = useMemo(() => {
        const selected = categories.find(
            (c) =>
                c.id === billState.categoryId ||
                c.children.some((s) => s.id === billState.categoryId),
        );
        if (selected?.children) {
            return selected.children;
        }
        return categories.find((c) => c.id === selected?.parent)?.children;
    }, [billState.categoryId, categories]);

    const toConfirm = useCallback(() => {
        onConfirm?.({
            ...billState,
        });
    }, [onConfirm, billState]);

    const chooseImage = async () => {
        const [file] = await showFilePicker({ accept: FORMAT_IMAGE_SUPPORTED });
        setBillState((v) => {
            return { ...v, images: [...(v.images ?? []), file] };
        });
    };

    const locationRef = useRef<HTMLButtonElement>(null);
    const isAdd = useRef(!edit);
    useEffect(() => {
        if (
            !isAdd.current ||
            !usePreferenceStore.getState().autoLocateWhenAddBill
        ) {
            return;
        }
        locationRef.current?.click?.();
    }, []);

    const monitorRef = useRef<HTMLButtonElement>(null);
    const [monitorFocused, setMonitorFocused] = useState(false);
    useEffect(() => {
        monitorRef.current?.focus?.();
    }, []);

    useEffect(() => {
        if (monitorFocused) {
            const onPress = (event: KeyboardEvent) => {
                const key = event.key;
                if (key === "Enter") {
                    toConfirm();
                }
            };
            document.addEventListener("keypress", onPress);
            return () => {
                document.removeEventListener("keypress", onPress);
            };
        }
    }, [monitorFocused, toConfirm]);

    const targetCurrency =
        allCurrencies.find(
            (c) => c.id === (billState.currency?.target ?? baseCurrency.id),
        ) ?? baseCurrency;

    const changeCurrency = (newCurrencyId: string) =>
        setBillState((prev) => {
            if (newCurrencyId === baseCurrency.id) {
                return {
                    ...prev,
                    amount: prev.currency?.amount ?? prev.amount,
                    currency: undefined,
                };
            }
            const { predict } = convert(
                amountToNumber(prev.currency?.amount ?? prev.amount),
                newCurrencyId,
                baseCurrency.id,
                prev.time,
            );
            return {
                ...prev,
                amount: numberToAmount(predict),
                currency: {
                    base: baseCurrency.id,
                    target: newCurrencyId,
                    amount: prev.currency?.amount ?? prev.amount,
                },
            };
        });

    const calculatorInitialValue = billState?.currency
        ? amountToNumber(billState.currency.amount)
        : billState?.amount
          ? amountToNumber(billState?.amount)
          : 0;

    const multiplyKey = usePreferenceStore((v) => {
        if (!v.multiplyKey || v.multiplyKey === "off") {
            return undefined;
        }
        if (v.multiplyKey === "double-zero") {
            return "double-zero";
        }
        return "triple-zero";
    });
    return (
        <Calculator.Root
            multiplyKey={multiplyKey}
            initialValue={calculatorInitialValue}
            onValueChange={(n) => {
                setBillState((v) => {
                    if (v.currency) {
                        const { predict } = convert(
                            n,
                            v.currency.target,
                            v.currency.base,
                            v.time,
                        );
                        return {
                            ...v,
                            amount: numberToAmount(predict),
                            currency: {
                                ...v.currency,
                                amount: numberToAmount(n),
                            },
                        };
                    }
                    return {
                        ...v,
                        amount: numberToAmount(n),
                    };
                });
            }}
            input={monitorFocused}
        >
            <PopupLayout
                className="h-full gap-2 pb-0 overflow-y-auto scrollbar-hidden"
                onBack={goBack}
                title={
                    <div className="pl-[54px] w-full min-h-12 rounded-lg flex pt-2 pb-0 overflow-hidden scrollbar-hidden">
                        <div className="text-white">
                            <Switch.Root
                                className="w-24 h-12 relative bg-stone-900 rounded-lg p-1 flex justify-center items-center"
                                checked={billState.type === "income"}
                                onCheckedChange={() => {
                                    setBillState((v) => ({
                                        ...v,
                                        type:
                                            v.type === "expense"
                                                ? "income"
                                                : "expense",
                                        categoryId:
                                            v.type === "expense"
                                                ? IncomeBillCategories[0].id
                                                : ExpenseBillCategories[0].id,
                                    }));
                                }}
                            >
                                <Switch.Thumb className="w-1/2 h-full flex justify-center items-center transition-all rounded-md bg-red-700 -translate-x-[22px] data-[state=checked]:bg-green-700 data-[state=checked]:translate-x-[21px]">
                                    <span className="text-[8px]">
                                        {billState.type === "expense"
                                            ? t("expense")
                                            : t("income")}
                                    </span>
                                </Switch.Thumb>
                            </Switch.Root>
                        </div>
                        <div className="flex-1 flex bg-stone-400 focus:outline rounded-lg ml-2 px-2 relative">
                            {quickCurrencies.length > 0 && (
                                <Select
                                    value={targetCurrency?.id}
                                    onValueChange={(newCurrencyId) => {
                                        changeCurrency(newCurrencyId);
                                    }}
                                >
                                    <div className="flex items-center">
                                        <SelectTrigger className="w-fit outline-none ring-none border-none shadow-none p-0 [&_svg]:hidden">
                                            <div className="flex items-center font-semibold text-2xl text-white">
                                                {targetCurrency?.symbol}
                                            </div>
                                        </SelectTrigger>
                                    </div>
                                    <SelectContent>
                                        {quickCurrencies.map((currency) => (
                                            <SelectItem
                                                key={currency.id}
                                                value={currency.id}
                                            >
                                                {currency.label}
                                                {`(${currency.symbol})`}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                            <button
                                ref={monitorRef}
                                type="button"
                                onFocus={() => {
                                    setMonitorFocused(true);
                                }}
                                onBlur={() => {
                                    setMonitorFocused(false);
                                }}
                                className="flex-1 flex flex-col justify-center items-end overflow-x-scroll"
                            >
                                {billState.currency && (
                                    <div className="absolute text-white text-[8px] top-0">
                                        ≈ {baseCurrency.symbol}{" "}
                                        {amountToNumber(billState.amount)}{" "}
                                        {baseCurrency.label}
                                    </div>
                                )}
                                <Calculator.Value className="text-white text-3xl font-semibold text-right bg-transparent"></Calculator.Value>
                                {billState.amount < 0 && (
                                    <div className="absolute text-red-700 text-[8px] bottom-0">
                                        {t("bill-negative-tip")}
                                    </div>
                                )}
                            </button>
                        </div>
                    </div>
                }
            >
                {/* categories */}
                <div className="flex-1 flex-shrink-0 overflow-y-auto min-h-[80px] scrollbar-hidden flex flex-col px-2 text-sm font-medium gap-2">
                    <div className="flex flex-col min-h-[80px] grow-[2] shrink overflow-y-auto scrollbar-hidden w-full">
                        <div
                            className={cn(
                                "grid gap-1",
                                categoriesGridClassName(categories),
                            )}
                        >
                            {categories.map((item) => (
                                <CategoryItem
                                    key={item.id}
                                    category={item}
                                    selected={billState.categoryId === item.id}
                                    onMouseDown={() => {
                                        setBillState((v) => ({
                                            ...v,
                                            categoryId: item.id,
                                        }));
                                    }}
                                />
                            ))}
                            <button
                                type="button"
                                className={cn(
                                    `rounded-lg border flex-1 py-1 px-2 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
                                )}
                                onClick={() => {
                                    showCategoryList(billState.type);
                                }}
                            >
                                <i className="icon-[mdi--settings]"></i>
                                {t("edit")}
                            </button>
                        </div>
                    </div>
                    {(subCategories?.length ?? 0) > 0 && (
                        <div className="flex flex-col min-h-[68px] grow-[1] shrink max-h-fit overflow-y-auto rounded-md border p-2 shadow scrollbar-hidden">
                            <div
                                className={cn(
                                    "grid gap-1",
                                    categoriesGridClassName(subCategories),
                                )}
                            >
                                {subCategories?.map((subCategory) => {
                                    return (
                                        <CategoryItem
                                            key={subCategory.id}
                                            category={subCategory}
                                            selected={
                                                billState.categoryId ===
                                                subCategory.id
                                            }
                                            onMouseDown={() => {
                                                setBillState((v) => ({
                                                    ...v,
                                                    categoryId: subCategory.id,
                                                }));
                                            }}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
                {/* tags */}
                <div className="w-full h-[40px] flex-shrink-0 flex-grow-0 flex gap-1 py-1 items-center overflow-x-auto px-2 text-sm font-medium scrollbar-hidden">
                    <TagGroupSelector
                        isCreate={isCreate}
                        selectedTags={billState.tagIds}
                        onSelectChange={(newTagIds, extra) => {
                            setBillState((prev) => ({
                                ...prev,
                                tagIds: newTagIds,
                            }));
                            if (extra?.preferCurrency) {
                                changeCurrency(extra.preferCurrency);
                            }
                        }}
                    />
                    <button
                        type="button"
                        className={cn(
                            `rounded-lg border py-1 px-2 my-1 mr-1 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
                        )}
                        onClick={() => {
                            showTagList();
                        }}
                    >
                        <i className="icon-[mdi--tag-text-outline]"></i>
                        {t("edit-tags")}
                    </button>
                </div>

                {/* keyboard area */}
                <div className="keyboard-field min-h-[max(min(calc(100%-264px),480px),362px)] max-h-[calc(100%-264px)] sm:min-h-[max(min(calc(100%-264px),380px),362px)] flex gap-2 flex-col justify-start bg-stone-900 sm:rounded-b-md text-[white] p-2 pb-[max(env(safe-area-inset-bottom),8px)]">
                    <div className="flex justify-between items-center">
                        <div className="flex gap-2 items-center h-10">
                            <div className="flex items-center h-full">
                                {(billState.images?.length ?? 0) > 0 && (
                                    <div className="pr-2 flex gap-[6px] items-center overflow-x-auto max-w-22 h-full scrollbar-hidden">
                                        {billState.images?.map((img, index) => (
                                            <Deletable
                                                // biome-ignore lint/suspicious/noArrayIndexKey: <explanation>
                                                key={index}
                                                onDelete={() => {
                                                    setBillState((v) => ({
                                                        ...v,
                                                        images: v.images?.filter(
                                                            (m) => m !== img,
                                                        ),
                                                    }));
                                                }}
                                            >
                                                <SmartImage
                                                    source={img}
                                                    alt=""
                                                    className="w-6 h-6 object-cover rounded"
                                                />
                                            </Deletable>
                                        ))}
                                    </div>
                                )}
                                {(billState.images?.length ?? 0) < 3 && (
                                    <button
                                        type="button"
                                        className="px-1 flex justify-center items-center rounded-full transition-all cursor-pointer"
                                        onClick={chooseImage}
                                    >
                                        <i className="icon-xs icon-[mdi--image-plus-outline] text-[white]"></i>
                                    </button>
                                )}
                            </div>
                            <div className="h-full flex items-center">
                                {billState?.location ? (
                                    <Deletable
                                        onDelete={() => {
                                            setBillState((prev) => {
                                                return {
                                                    ...prev,
                                                    location: undefined,
                                                };
                                            });
                                        }}
                                    >
                                        <i className="w-5 icon-[mdi--location-radius]"></i>
                                    </Deletable>
                                ) : (
                                    <CurrentLocation
                                        ref={locationRef}
                                        className="px-1 flex items-center justify-center"
                                        onValueChange={(v) => {
                                            setBillState((prev) => {
                                                return { ...prev, location: v };
                                            });
                                        }}
                                    >
                                        <i className="icon-[mdi--add-location]" />
                                    </CurrentLocation>
                                )}
                            </div>
                            <div className="rounded-full transition-all hover:(bg-stone-700) active:(bg-stone-500)">
                                <DatePicker
                                    value={billState.time}
                                    onChange={(time) => {
                                        setBillState((prev) => {
                                            if (!prev.currency) {
                                                return {
                                                    ...prev,
                                                    time: time,
                                                };
                                            }
                                            const { predict } = convert(
                                                amountToNumber(
                                                    prev.currency?.amount ??
                                                        prev.amount,
                                                ),
                                                prev.currency.target,
                                                baseCurrency.id,
                                                time,
                                            );
                                            return {
                                                ...prev,
                                                time: time,
                                                amount: numberToAmount(predict),
                                                currency: {
                                                    base: baseCurrency.id,
                                                    target: prev.currency
                                                        .target,
                                                    amount:
                                                        prev.currency?.amount ??
                                                        prev.amount,
                                                },
                                            };
                                        });
                                    }}
                                />
                            </div>
                        </div>
                        <RemarkHint
                            recommends={predictComments}
                            onSelect={(v) => {
                                setBillState((prev) => ({
                                    ...prev,
                                    comment: `${prev.comment} ${v}`,
                                }));
                            }}
                        >
                            <div className="flex h-full flex-1">
                                <IOSUnscrolledInput
                                    value={billState.comment}
                                    onChange={(e) => {
                                        setBillState((v) => ({
                                            ...v,
                                            comment: e.target.value,
                                        }));
                                    }}
                                    type="text"
                                    className="w-full bg-transparent text-white text-right placeholder-opacity-50 outline-none"
                                    placeholder={t("comment")}
                                    enterKeyHint="done"
                                />
                            </div>
                        </RemarkHint>
                    </div>

                    <button
                        type="button"
                        className="flex h-[80px] min-h-[48px] justify-center items-center bg-green-700 rounded-lg font-bold text-lg cursor-pointer"
                        onClick={toConfirm}
                    >
                        <i className="icon-[mdi--check] icon-md"></i>
                    </button>
                    <Calculator.Keyboard
                        className={cn("flex-1")}
                        onKey={(v) => {
                            if (v === "r") {
                                toConfirm();
                                setTimeout(() => {
                                    goAddBill();
                                }, 10);
                            }
                        }}
                    />
                </div>
            </PopupLayout>
        </Calculator.Root>
    );
}
