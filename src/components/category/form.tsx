import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { StorageDeferredAPI } from "@/api/storage";
import createConfirmProvider from "@/components/confirm";
import { Button } from "@/components/ui/button";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import useCategory from "@/hooks/use-category";
import PopupLayout from "@/layouts/popup-layout";
import type { BillCategory, BillType } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { cn } from "@/utils";
import CategoryIcon from "./icon";
import { ICONS } from "./icons";

const NO_PARENT = "__noparent";

export const createFormSchema = (t: any) =>
    z.object({
        name: z
            .string()
            .check(z.maxLength(50, { message: t("max-name-length-limit") })),

        // 可选字符串
        parent: z.optional(z.string()),
    });

const allIcons = ICONS;
const validSvgText = (text: string) =>
    text.startsWith("<svg") && text.endsWith("</svg>");

export default function CategoryEditForm({
    onCancel,
    onConfirm,
    edit,
}: {
    edit?: BillCategory | { id: undefined; parent?: string; type: BillType };
    onCancel?: () => void;
    onConfirm?: (v: any) => void;
}) {
    const t = useIntl();
    const [category, setCategory] = useState<Omit<BillCategory, "id">>(() => {
        if (edit === undefined || edit.id === undefined) {
            return {
                name: "",
                customName: true,
                type: edit?.type ?? "expense",
                color: "#fff",
                icon: ICONS[0].icons[0].className,
                ...edit,
            };
        }
        return {
            ...edit,
        };
    });

    const formSchema = useMemo(() => createFormSchema(t), [t]);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: category
            ? {
                  name: category.name,
                  parent: category.parent,
              }
            : {
                  name: "",
              },
    });
    const {
        expenses: allExpenses,
        incomes: allIncomes,
        categories: allCategories,
        update,
        add,
        reorder,
    } = useCategory();
    const expenses = allExpenses;
    const incomes = allIncomes;

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        if (edit === undefined || edit.id === undefined) {
            // add category
            const newCategory = {
                ...category,
                ...data,
            };
            console.log("add category:", newCategory);
            const newId = await add(newCategory);
            onConfirm?.(newId);
            return;
        }
        const originCate = {
            icon: edit.icon,
            name: edit.customName ? edit.name : t(edit.name),
            parent: edit.parent,
        };
        const formattedData = {
            ...data,
            icon: category?.icon,
            customName:
                edit.customName === true
                    ? true
                    : originCate.name !== data.name
                      ? true
                      : undefined,
        };
        if (
            originCate.icon === formattedData.icon &&
            originCate.name === formattedData.name &&
            originCate.parent === formattedData.parent
        ) {
            console.log("nothing changed");
            return;
        }

        console.log("update category:", formattedData);
        await update(edit.id, formattedData);
        onConfirm?.(edit.id);
    };

    const toDelete = async () => {
        if (!edit?.id) {
            return;
        }
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        const cates = allCategories.filter(
            (c) => c.id === edit.id || c.parent === edit.id,
        );
        const exist = await StorageDeferredAPI.filter(book, {
            categories: cates.map((c) => c.id),
        });
        if (exist.length > 0) {
            alert(t("category-delete-alert", { n: exist.length }));
            return;
        }
        // 删除类别
        await update(edit.id, undefined);
        onConfirm?.(undefined);
    };
    return (
        <Form {...form}>
            <PopupLayout
                className="overflow-hidden w-full h-full flex-col gap-2 items-center"
                onBack={onCancel}
                title={t("edit-category-details")}
                right={
                    <div className="flex items-center gap-2 pr-2">
                        {edit?.id && (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={toDelete}
                            >
                                <i className="icon-[mdi--trash-can-outline]" />
                            </Button>
                        )}
                        <Button
                            size="sm"
                            type="submit"
                            onClick={() => {
                                form.handleSubmit(onSubmit)();
                            }}
                        >
                            {t("confirm")}
                        </Button>
                    </div>
                }
            >
                <div className="flex justify-center items-center gap-2">
                    <div className="p-4 size-16 aspect-square rounded-full overflow-hidden border flex justify-center items-center">
                        {category?.icon && (
                            <CategoryIcon
                                icon={category?.icon}
                                className={cn("w-full h-full")}
                            />
                        )}
                    </div>
                    <div className="flex flex-col gap-2">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("category-name")}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="text"
                                            maxLength={50}
                                            {...field}
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        ></FormField>
                        <FormField
                            control={form.control}
                            name="parent"
                            render={({ field }) => {
                                const selectValue =
                                    field.value === undefined ||
                                    field.value === null
                                        ? NO_PARENT
                                        : field.value;
                                return (
                                    <FormItem>
                                        <FormLabel>
                                            {t("category-parent")}
                                        </FormLabel>
                                        <FormControl>
                                            <Select
                                                value={selectValue}
                                                onValueChange={(value) => {
                                                    let newValue:
                                                        | string
                                                        | undefined;
                                                    if (value === NO_PARENT) {
                                                        // 如果选择了 'NO_PARENT'，将 RHF 的值设置为 undefined
                                                        newValue = undefined;
                                                    } else {
                                                        // 否则，设置为 Select 传来的实际值
                                                        newValue = value;
                                                    }
                                                    // 调用 RHF 的 onChange 更新表单状态
                                                    field.onChange(newValue);
                                                }}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue
                                                            placeholder={t(
                                                                "parent-category",
                                                            )}
                                                        />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent align="end">
                                                    <SelectItem
                                                        value={NO_PARENT}
                                                    >
                                                        {t(
                                                            "no-parent-category",
                                                        )}
                                                    </SelectItem>
                                                    {(category.type ===
                                                    "expense"
                                                        ? expenses
                                                        : incomes
                                                    )
                                                        .filter(
                                                            (p) =>
                                                                p.id !==
                                                                edit?.id,
                                                        )
                                                        .map((p) => (
                                                            <SelectItem
                                                                key={p.id}
                                                                value={p.id}
                                                            >
                                                                {p.name}
                                                            </SelectItem>
                                                        ))}
                                                </SelectContent>
                                            </Select>
                                        </FormControl>
                                    </FormItem>
                                );
                            }}
                        ></FormField>
                    </div>
                </div>

                <Tabs
                    defaultValue="icons"
                    className="w-full flex flex-col flex-1 overflow-hidden p-2 gap-2"
                >
                    <div className="w-full flex justify-center">
                        <div className="flex items-center gap-2">
                            <TabsList>
                                <TabsTrigger value="icons">
                                    {t("icons-tab")}
                                </TabsTrigger>
                                <TabsTrigger value="custom">
                                    {t("custom-tab")}
                                </TabsTrigger>
                            </TabsList>
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto border rounded-lg p-2">
                        <TabsContent
                            value="icons"
                            className="flex flex-col gap-2"
                        >
                            {allIcons.map((iconSet) => (
                                <div
                                    key={iconSet.labelKey}
                                    className="flex flex-col gap-2"
                                >
                                    <div className="text-sm">
                                        {t(iconSet.labelKey)}
                                    </div>
                                    <div
                                        className={
                                            "grid grid-cols-[repeat(auto-fill,minmax(48px,1fr))] gap-2"
                                        }
                                    >
                                        {iconSet.icons.map((icon) => (
                                            <button
                                                key={
                                                    iconSet.labelKey + icon.name
                                                }
                                                type="button"
                                                onClick={() => {
                                                    setCategory(
                                                        (v) =>
                                                            ({
                                                                ...v,
                                                                icon: icon.className,
                                                            }) as any,
                                                    );
                                                }}
                                                className="size-12 p-2 rounded-full border flex justify-center items-center cursor-pointer"
                                            >
                                                <i
                                                    className={cn(
                                                        icon.className,
                                                    )}
                                                ></i>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </TabsContent>
                        <TabsContent
                            value="custom"
                            className="w-full h-full flex flex-col gap-2 m-0"
                        >
                            <div className="w-full h-full flex flex-col gap-2">
                                <div className="text-sm opacity-80 flex justify-between items-center px-2">
                                    <div>{t("copy-and-paste-svg-below")}:</div>
                                    <Button size="sm">{t("clear")}</Button>
                                </div>
                                <textarea
                                    className="w-full flex-1 border rounded-lg p-2"
                                    onChange={(e) => {
                                        const svgText = e.currentTarget.value;
                                        if (
                                            !svgText ||
                                            !validSvgText(svgText)
                                        ) {
                                            setCategory(
                                                (v) =>
                                                    ({
                                                        ...v,
                                                        icon: v?.icon,
                                                    }) as any,
                                            );
                                            return;
                                        }
                                        setCategory(
                                            (v) =>
                                                ({
                                                    ...v,
                                                    icon: svgText,
                                                }) as any,
                                        );
                                    }}
                                />
                            </div>
                        </TabsContent>
                    </div>
                </Tabs>
            </PopupLayout>
        </Form>
    );
}

export const [CategoryEditFormProvider, showCategoryEdit] =
    createConfirmProvider(CategoryEditForm, {
        dialogTitle: "Category Edit",
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    });
