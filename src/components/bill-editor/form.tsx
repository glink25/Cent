import { Switch } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import useCategory from "@/hooks/use-category";
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
import { goAddBill } from ".";

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

    const [billState, setBillState] = useState({
        ...defaultBill,
        time: Date.now(),
        ...edit,
    });

    // useEffect(() => {
    // 	setBillState({ ...defaultBill, ...edit });
    // }, [edit]);
    const { incomes, expenses } = useCategory();

    const { tags, add: addTag } = useTag();

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

    const toConfirm = () => {
        onConfirm?.({
            ...billState,
        });
    };

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

    return (
        <Calculator.Root
            initialValue={edit?.amount ? amountToNumber(edit?.amount) : 0}
            onValueChange={(n) => {
                setBillState((v) => ({
                    ...v,
                    amount: numberToAmount(n),
                }));
            }}
        >
            <PopupLayout
                className="h-full gap-2 pb-0"
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
                        <div className="flex-1 flex flex-col justify-center items-end bg-stone-400 rounded-lg ml-2 px-2 overflow-x-scroll">
                            <Calculator.Value className="text-white text-3xl font-semibold text-right bg-transparent"></Calculator.Value>
                            {billState.amount < 0 && (
                                <div className="absolute text-red-700 text-[8px] bottom-0 translate-y-[calc(-50%-2px)]">
                                    {t("bill-negative-tip")}
                                </div>
                            )}
                        </div>
                    </div>
                }
            >
                {/* categories */}
                <div className="flex-1 overflow-hidden flex flex-col px-2 text-sm font-medium gap-2">
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
                                showCategoryList();
                            }}
                        >
                            <i className="icon-[mdi--settings]"></i>
                            {t("edit")}
                        </button>
                    </div>
                    {(subCategories?.length ?? 0) > 0 && (
                        <div className="flex-1 overflow-y-auto rounded-md border p-2 shadow scrollbar-hidden">
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
                    {tags.map((tag) => (
                        <Tag
                            key={tag.id}
                            checked={billState.tagIds?.includes(tag.id)}
                            onCheckedChange={(checked) => {
                                setBillState((prev) => {
                                    const newV = { ...prev };
                                    if (checked) {
                                        newV.tagIds = Array.from(
                                            new Set([
                                                ...(newV.tagIds ?? []),
                                                tag.id,
                                            ]),
                                        );
                                    } else {
                                        newV.tagIds = newV.tagIds?.filter(
                                            (t) => t !== tag.id,
                                        );
                                    }
                                    return newV;
                                });
                            }}
                        >
                            #{tag.name}
                        </Tag>
                    ))}
                    <button
                        type="button"
                        className={cn(
                            `rounded-lg border py-1 px-2 my-1 mr-1 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
                        )}
                        onClick={async () => {
                            try {
                                const tagName = prompt(t("input-new-tag-name"));
                                if (tagName === null || tagName === undefined) {
                                    return;
                                }
                                await addTag({ name: tagName });
                            } catch (error) {
                                toast.error((error as any).message);
                            }
                        }}
                    >
                        <i className="icon-[mdi--tag-plus-outline]"></i>
                        {t("add-tag")}
                    </button>
                </div>

                {/* keyboard area */}
                <div className="keyboard-field h-[480px] sm:h-[380px] flex-shrink-0 flex gap-2 flex-col justify-start bg-stone-900 sm:rounded-b-md text-[white] p-2 pb-[max(env(safe-area-inset-bottom),8px)]">
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
                                        className="px-1 flex justify-center items-center rounded-full transition-all hover:(bg-stone-700) active:(bg-stone-500) cursor-pointer"
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
                                        setBillState((v) => ({
                                            ...v,
                                            time: time,
                                        }));
                                    }}
                                />
                            </div>
                        </div>
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
                    </div>

                    <button
                        type="button"
                        className="flex h-[80px] justify-center items-center bg-green-700 rounded-lg font-bold text-lg cursor-pointer"
                        onClick={toConfirm}
                    >
                        <i className="icon-[mdi--check] icon-md"></i>
                    </button>
                    <Calculator.Keyboard
                        className={cn("flex-1 grid-cols-[2fr_2fr_2fr_1fr_1fr]")}
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
