import { zodResolver } from "@hookform/resolvers/zod";
import { Collapsible } from "radix-ui";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { useTag } from "@/hooks/use-tag";
import type { BillTagGroup } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
} from "../ui/form";
import { Input } from "../ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import { Switch } from "../ui/switch";

export const createFormSchema = (t: any) =>
    z.object({
        name: z.string().check(
            z.maxLength(50, {
                message: t("max-name-length-limit", { n: 50 }),
            }),
        ),
        color: z.string(),
        singleSelect: z.optional(z.boolean()),
        required: z.optional(z.boolean()),
        tagIds: z.array(z.string()),
    });

export type EditTagGroup = Omit<BillTagGroup, "id"> & { id?: string };
const colors = [
    {
        name: "red",
        light: "#FF5F57",
        dark: "#FF6961",
    },
    {
        name: "orange",
        light: "#FFBD2E",
        dark: "#FFB340",
    },
    {
        name: "yellow",
        light: "#B28200",
        dark: "#FFD426",
    },
    {
        name: "green",
        light: "#28C941",
        dark: "#32D74B",
    },
    {
        name: "blue",
        light: "#007AFF",
        dark: "#0A84FF",
    },
    {
        name: "purple",
        light: "#A550A7",
        dark: "#BF5AF2",
    },
    {
        name: "gray",
        light: "#8E8E93",
        dark: "#98989D",
    },
];

const EditTagGroupForm = ({
    edit,
    onConfirm,
    onCancel,
}: {
    edit?: EditTagGroup;
    onConfirm?: (v: EditTagGroup | "delete") => void;
    onCancel?: () => void;
}) => {
    const t = useIntl();
    const { tags } = useTag();
    const formSchema = useMemo(() => createFormSchema(t), [t]);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: edit ?? { color: "gray" },
    });
    const isCreate = edit === undefined;

    const toSubmit = () => {
        const onSubmit = (data: z.infer<typeof formSchema>) => {
            onConfirm?.({ ...data, id: edit?.id });
        };
        form.handleSubmit(onSubmit)();
    };

    const formatTagName = (tagIds?: string[]) => {
        const names = tagIds
            ?.map((tagId) => tags.find((v) => v.id === tagId))
            .filter((v) => v !== undefined)
            .map((v) => v.name);
        return names?.join(",") ?? t("none");
    };
    return (
        <Form {...form}>
            <div className="w-full h-full flex flex-col">
                <div className="px-4 text-center">
                    {isCreate ? t("add-new-tag-group") : t("edit-tag-group")}
                </div>
                <div className="px-4 flex flex-1 flex-col gap-4 overflow-y-auto">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => {
                            return (
                                <FormItem>
                                    <FormLabel>{t("tag-group-name")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} maxLength={50} />
                                    </FormControl>
                                </FormItem>
                            );
                        }}
                    ></FormField>

                    <FormField
                        control={form.control}
                        name="tagIds"
                        render={({ field }) => {
                            return (
                                <FormItem className="flex justify-between items-center">
                                    <FormLabel className="m-0">
                                        {t("group-tags")}
                                    </FormLabel>
                                    <FormControl>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    className="px-2 md:px-4 py-2 text-xs md:text-sm"
                                                >
                                                    <div className=" max-w-[200px] truncate">
                                                        {formatTagName(
                                                            field.value,
                                                        )}
                                                    </div>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent
                                                className="w-56"
                                                align="end"
                                            >
                                                {tags.map((item) => (
                                                    <DropdownMenuCheckboxItem
                                                        key={item.id}
                                                        onSelect={(e) =>
                                                            e.preventDefault()
                                                        }
                                                        checked={field.value?.some(
                                                            (v) =>
                                                                v === item.id,
                                                        )}
                                                        onCheckedChange={(
                                                            v,
                                                        ) => {
                                                            const newV = v
                                                                ? [
                                                                      ...(field.value ??
                                                                          []),
                                                                      item.id,
                                                                  ]
                                                                : field.value?.filter(
                                                                      (x) =>
                                                                          x !==
                                                                          item.id,
                                                                  );
                                                            field.onChange(
                                                                newV,
                                                            );
                                                        }}
                                                    >
                                                        {item.name}
                                                    </DropdownMenuCheckboxItem>
                                                ))}
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </FormControl>
                                </FormItem>
                            );
                        }}
                    ></FormField>

                    <FormField
                        control={form.control}
                        name="color"
                        render={({ field }) => {
                            return (
                                <FormItem className="flex justify-between items-center">
                                    <FormLabel className="m-0">
                                        {t("tag-group-color")}
                                    </FormLabel>

                                    <FormControl>
                                        <ColorPicker
                                            value={field.value}
                                            onChange={field.onChange}
                                        />
                                    </FormControl>
                                </FormItem>
                            );
                        }}
                    ></FormField>

                    <Collapsible.Root className="group">
                        <Collapsible.Trigger>
                            <div className="text-xs opacity-60 flex items-center gap-1">
                                {t("more-tag-settings")}
                                <i className="w-4 h-4 icon-[mdi--chevron-right] transition-all rotate-90 group-[[data-state=closed]]:rotate-0"></i>
                            </div>
                        </Collapsible.Trigger>
                        <Collapsible.CollapsibleContent>
                            <FormField
                                control={form.control}
                                name="singleSelect"
                                render={({ field }) => {
                                    return (
                                        <FormItem className="flex justify-between items-center">
                                            <div>
                                                <FormLabel>
                                                    {t("is-single-select")}
                                                </FormLabel>
                                                <FormDescription>
                                                    {t("single-select-desc")}
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={
                                                        field.value ?? false
                                                    }
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                    );
                                }}
                            ></FormField>
                            <FormField
                                control={form.control}
                                name="required"
                                render={({ field }) => {
                                    return (
                                        <FormItem className="flex justify-between items-center">
                                            <div>
                                                <FormLabel>
                                                    {t("is-required-select")}
                                                </FormLabel>
                                                <FormDescription>
                                                    {t("required-select-desc")}
                                                </FormDescription>
                                            </div>
                                            <FormControl>
                                                <Switch
                                                    checked={
                                                        field.value ?? false
                                                    }
                                                    onCheckedChange={
                                                        field.onChange
                                                    }
                                                />
                                            </FormControl>
                                        </FormItem>
                                    );
                                }}
                            ></FormField>
                        </Collapsible.CollapsibleContent>
                    </Collapsible.Root>
                </div>
                <div className="flex justify-between items-center px-4">
                    <div>
                        {!isCreate && (
                            <Button
                                variant={"destructive"}
                                onClick={() => {
                                    onConfirm?.("delete");
                                }}
                            >
                                {t("delete")}
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2 items-center">
                        <Button onClick={onCancel}>{t("cancel")}</Button>
                        <Button onClick={toSubmit}>{t("confirm")}</Button>
                    </div>
                </div>
            </div>
        </Form>
    );
};

function ColorPicker({
    className,
    value,
    onChange,
}: {
    value: string;
    className?: string;
    onChange?: (color: string) => void;
}) {
    return (
        <div className={cn("flex gap-3", className)}>
            {colors.map((color) => {
                return (
                    <button
                        key={color.name}
                        type="button"
                        onClick={() => onChange?.(color.name)}
                        className={cn(
                            "w-4 h-4 rounded-full cursor-pointer with-tag-color bg-[var(--current-tag-color)] ring-2 ring-transparent",
                            `tag-${color.name}`,
                            value === color.name && "ring-foreground",
                        )}
                    ></button>
                );
            })}
        </div>
    );
}

export const [EditTagGroupProvider, showEditTagGroup] = createConfirmProvider(
    EditTagGroupForm,
    {
        dialogTitle: "Edit Tag Group",
        dialogModalClose: false,
        fade: true,
        swipe: false,
        contentClassName: "w-[350px] h-[480px] max-h-[55vh] py-4",
    },
);
