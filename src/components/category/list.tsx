import { Collapsible } from "radix-ui";
import { useState } from "react";
import { toast } from "sonner";
import useCategory from "@/hooks/use-category";
import PopupLayout from "@/layouts/popup-layout";
import type { BillCategory, BillType } from "@/ledger/type";
import { categoriesGridClassName, treeCategories } from "@/ledger/utils";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { showSortableList } from "../sortable";
import { Button } from "../ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { CategoryEditFormProvider, showCategoryEdit } from "./edit";
import { CategoryItem } from "./item";

export default function CategoryList({
    edit,
    onCancel,
}: {
    edit?: BillType;
    onCancel?: () => void;
    onConfirm?: (v: any) => void;
}) {
    const t = useIntl();
    const { categories, reorder, reset } = useCategory();

    const expenses = treeCategories(
        categories.filter((v) => v.type === "expense"),
    );
    const incomes = treeCategories(
        categories.filter((v) => v.type === "income"),
    );
    const tabs = [
        { label: "expense" as BillType, value: expenses },
        { label: "income" as BillType, value: incomes },
    ];
    const toAddChildCategory = (parentId: string) => {
        showCategoryEdit({
            id: undefined,
            parent: parentId,
            type: categories.find((c) => c.id === parentId)!.type,
        });
    };

    const toAddCategory = async (type: BillType) => {
        showCategoryEdit({
            id: undefined,
            type,
        });
    };

    const toEditCategory = async (cate: BillCategory) => {
        await showCategoryEdit(cate);
    };
    const [tab, setTab] = useState<string>(edit ?? "expense");
    return (
        <PopupLayout
            className="overflow-hidden h-full"
            onBack={onCancel}
            title={t("edit-categories")}
            right={
                <Button
                    onClick={async () => {
                        const ok = confirm(t("sure-to-reset-categories"));
                        if (!ok) {
                            return;
                        }
                        try {
                            await reset();
                            toast.success(t("reset-success"));
                        } catch (error) {
                            if (
                                (error as Error).message.startsWith(
                                    "still has transactions",
                                )
                            ) {
                                toast.error(
                                    t(
                                        "reset-categories-failed-by-existing-custom-category-transcations",
                                    ),
                                );
                            }
                        }
                    }}
                >
                    {t("reset")}
                </Button>
            }
        >
            <Tabs
                value={tab}
                onValueChange={setTab}
                className="px-2 pb-4 flex flex-col flex-1 overflow-hidden gap-2"
            >
                <div className="w-full flex justify-center">
                    <div>
                        <TabsList>
                            {tabs.map((tab) => (
                                <TabsTrigger key={tab.label} value={tab.label}>
                                    {t(tab.label)}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </div>
                </div>
                <div className="flex items-center justify-between">
                    <div className="px-2 text-xs text-foreground/80">
                        {t("click-category-to-edit")}
                    </div>
                    <Button
                        variant="ghost"
                        className="p-1 h-fit"
                        onClick={async () => {
                            const curTab = tabs.find((t) => t.label === tab);
                            if (!curTab) {
                                return;
                            }
                            const ordered = await showSortableList(
                                curTab.value,
                            );
                            reorder(ordered);
                        }}
                    >
                        <i className="icon-[mdi--reorder-horizontal]"></i>
                    </Button>
                </div>
                {tabs.map((v) => (
                    <TabsContent
                        key={v.label}
                        value={v.label}
                        className="mt-0 flex-1 overflow-y-auto scrollbar-hidden flex flex-col gap-4"
                    >
                        <Button
                            variant="outline"
                            onClick={() => {
                                toAddCategory(v.label);
                            }}
                        >
                            <i className="icon-[mdi--plus]"></i>
                            {t("add-new-category-group")}
                        </Button>
                        {v.value.map((parent, i) => {
                            return (
                                <Collapsible.Root
                                    key={parent.id}
                                    defaultOpen={i === 0}
                                    className="rounded-md border shadow group"
                                >
                                    <Collapsible.Trigger asChild>
                                        <div className="px-2 py-1 flex items-center justify-between">
                                            <div>
                                                <CategoryItem
                                                    category={parent}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        e.preventDefault();
                                                        toEditCategory(parent);
                                                    }}
                                                />
                                            </div>
                                            <div>
                                                <Button
                                                    variant="ghost"
                                                    className="p-1 h-fit"
                                                    onClick={async (e) => {
                                                        e.preventDefault();
                                                        e.stopPropagation();
                                                        const ordered =
                                                            await showSortableList(
                                                                parent.children,
                                                            );
                                                        reorder(ordered);
                                                    }}
                                                >
                                                    <i className="icon-[mdi--reorder-horizontal]"></i>
                                                </Button>
                                                <i className=" group-[[data-state=open]]:icon-[mdi--chevron-down] group-[[data-state=closed]]:icon-[mdi--chevron-up]" />
                                            </div>
                                        </div>
                                    </Collapsible.Trigger>
                                    <Collapsible.Content className="border-t data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
                                        <div
                                            className={cn(
                                                "p-4 grid gap-1 text-sm",
                                                categoriesGridClassName(
                                                    parent.children,
                                                ),
                                            )}
                                        >
                                            {parent.children.map((child) => {
                                                return (
                                                    <CategoryItem
                                                        key={child.id}
                                                        category={child}
                                                        onClick={() =>
                                                            toEditCategory(
                                                                child,
                                                            )
                                                        }
                                                    />
                                                );
                                            })}
                                            <button
                                                type="button"
                                                className="rounded-lg border flex justify-center items-center"
                                                onClick={() =>
                                                    toAddChildCategory(
                                                        parent.id,
                                                    )
                                                }
                                            >
                                                <i className="icon-[mdi--plus]"></i>
                                                {t("add")}
                                            </button>
                                        </div>
                                    </Collapsible.Content>
                                </Collapsible.Root>
                            );
                        })}
                    </TabsContent>
                ))}
            </Tabs>
            <CategoryEditFormProvider />
        </PopupLayout>
    );
}
