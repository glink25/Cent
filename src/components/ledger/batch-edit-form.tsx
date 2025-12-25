import { useState } from "react";
import useCategory from "@/hooks/use-category";
import { useTag } from "@/hooks/use-tag";
import PopupLayout from "@/layouts/popup-layout";
import type { BillType } from "@/ledger/type";
import { useIntl } from "@/locale";
import { SingleCascadeSelect } from "../cascade/single";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";

export type BatchEditOptions = {
    type?: BillType;
    categoryId?: string;
    tagIds?: string[];
};

export default function BatchEditForm({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: BatchEditOptions;
    onConfirm?: (v: BatchEditOptions) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const [state, setState] = useState(edit ?? {});
    const { incomes, expenses } = useCategory();

    const type =
        state.type === undefined
            ? undefined
            : state.type === "income"
              ? t("income")
              : t("expense");
    const categories =
        state.type === "income"
            ? incomes
            : state.type === "expense"
              ? expenses
              : [];
    const category =
        state.categoryId === undefined
            ? t("original-category")
            : categories.find((c) => c.id === state.categoryId)?.name;
    const { tags } = useTag();
    const tag =
        state.tagIds === undefined
            ? t("original-tag")
            : state.tagIds.length === 0
              ? t("no-tags")
              : state.tagIds
                    .map((id) => tags.find((v) => v.id === id)?.name)
                    .join(",");
    return (
        <PopupLayout
            title={t("batch-edit")}
            right={
                <Button
                    onClick={() => {
                        onConfirm?.(state);
                    }}
                >
                    {t("confirm")}
                </Button>
            }
            onBack={onCancel}
            className="h-full overflow-hidden flex flex-col gap-2"
        >
            <div className="flex justify-between py-2 px-4 border-b">
                <div className="flex flex-col">
                    <div>{t("change-bills-type")}</div>
                    <div className="text-xs opacity-60">
                        {state.type === undefined
                            ? t("ledger-will-keep-original-type")
                            : t("ledger-type-will-be-updated-to", { n: type })}
                    </div>
                </div>
                <Select
                    value={state.type}
                    onValueChange={(v) => {
                        setState((prev) => ({
                            ...prev,
                            type: v as BillType,
                            categoryId: undefined,
                        }));
                    }}
                >
                    <SelectTrigger className="w-fit">
                        <div>{type}</div>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value={"income"}>{t("income")}</SelectItem>
                        <SelectItem value={"expense"}>
                            {t("expense")}
                        </SelectItem>
                    </SelectContent>
                </Select>
            </div>
            <div className="flex justify-between py-2 px-4 border-b">
                <div className="flex flex-col">
                    <div>{t("change-categories-of-ledger")}</div>
                    <div className="text-xs opacity-60">
                        {state.categoryId === undefined
                            ? t("ledger-will-keep-original-category")
                            : t("ledger-category-will-updated-to", {
                                  n: category,
                              })}
                    </div>
                </div>
                <SingleCascadeSelect
                    list={categories}
                    value={state.categoryId}
                    onValueChange={(v) => {
                        setState((prev) => ({ ...prev, categoryId: v }));
                    }}
                    placeholder={"原有类别"}
                ></SingleCascadeSelect>
            </div>
            <div className="flex justify-between py-2 px-4 border-b">
                <div className="flex flex-col">
                    <div>{t("change-bills-tags")}</div>
                    <div className="text-xs opacity-60">
                        {state.tagIds === undefined
                            ? t("ledger-will-keep-original-tags")
                            : state.tagIds.length === 0
                              ? t("ledger-tags-will-be-clear")
                              : t("ledger-tags-will-be-changed")}
                    </div>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            className="px-2 md:px-4 py-2 text-xs md:text-sm"
                        >
                            <div className="max-w-[120px] truncate">{tag}</div>
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="w-56" align="end">
                        {tags.map((item) => (
                            <DropdownMenuCheckboxItem
                                key={item.id}
                                checked={state.tagIds?.includes(item.id)}
                                onCheckedChange={(v) => {
                                    setState((prev) => {
                                        const set = new Set(prev.tagIds);
                                        if (v) {
                                            set.add(item.id);
                                        } else {
                                            set.delete(item.id);
                                        }
                                        const newTags = Array.from(set);
                                        return {
                                            ...prev,
                                            tagIds: newTags,
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
        </PopupLayout>
    );
}
