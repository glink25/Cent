import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { CalendarIcon, Plus, X } from "lucide-react";
import { useMemo } from "react";
import { useFieldArray, useForm } from "react-hook-form";
import * as z from "zod/mini";
import { Calendar } from "@/components/ui/calendar";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Form,
    FormControl,
    FormDescription,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import useCategory from "@/hooks/use-category";
import { useCreators } from "@/hooks/use-creator";
import { useTag } from "@/hooks/use-tag";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { CascadeSelect } from "../cascade";
import { Button } from "../ui/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import type { Budget } from "./type";

export const createFormSchema = (t: any) =>
    z.object({
        title: z.string(),

        // 保留自定义错误信息
        start: z.date({ error: t("please-select-start-date") }),
        end: z.optional(z.date()),

        repeat: z.object({
            unit: z.enum(["week", "day", "month", "year"], {
                error: t("please-select-period-unit"),
            }),
            // 用 check + 顶层检查函数替代链式 .int().positive()
            value: z.number().check(
                z.int(),
                z.positive({
                    message: t("period-must-be-positive-integer"),
                }),
            ),
        }),

        // 至少有 1 项参与者（用 minSize 更易 tree-shake）
        joiners: z.array(z.union([z.string(), z.number()])).check(
            z.minLength(1, {
                message: t("select-one-participant-at-least"),
            }),
        ),

        // 使用 coerce 将字符串之类的转换为数值，再用 gte(0) 校验非负
        totalBudget: z.coerce
            .number()
            .check(z.gte(0, { message: t("budget-cannot-be-negative") })),

        categoriesBudget: z.optional(
            z.array(
                z.object({
                    // 要求非空字符串作为 id
                    id: z.string().check(
                        z.minLength(1, {
                            message: t("please-select-a-category"),
                        }),
                    ),
                    budget: z.coerce.number().check(
                        z.gte(0, {
                            message: t("budget-cannot-be-negative"),
                        }),
                    ),
                }),
            ),
        ),

        onlyTags: z.optional(z.array(z.string())),
        excludeTags: z.optional(z.array(z.string())),
    });

type EditBudget = Omit<Budget, "id"> & { id?: string };

export default function BudgetEditForm({
    edit,
    onConfirm,
    onCancel,
}: {
    edit?: EditBudget;
    onConfirm?: (v?: EditBudget) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const joiners = useCreators();
    const { expenses } = useCategory();
    const { tags } = useTag();
    const categoryOption = expenses;
    const formSchema = useMemo(() => createFormSchema(t), [t]);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: edit
            ? {
                  ...edit,
                  start: edit?.start
                      ? dayjs.unix(edit.start / 1000).toDate()
                      : undefined,
                  end: edit?.end
                      ? dayjs.unix(edit.end / 1000).toDate()
                      : undefined,
              }
            : {
                  title: t("new-budget"),
                  start: new Date(),
                  joiners: [],
                  totalBudget: 0,
                  repeat: {
                      value: 1,
                      unit: "month",
                  },
                  onlyTags: [],
                  excludeTags: [],
              },
    });

    const { fields, append, remove } = useFieldArray({
        name: "categoriesBudget",
        control: form.control,
    });

    function onSubmit(data: z.infer<typeof formSchema>) {
        // 将 date 对象转换为 number
        const formattedData = {
            ...data,
            start: data.start.getTime(),
            end: data.end ? data.end.getTime() : undefined,
        };
        console.log(formattedData);
        onConfirm?.(formattedData);
    }
    return (
        <Form {...form}>
            <form
                className="h-full w-full"
                onSubmit={form.handleSubmit(onSubmit)}
            >
                <PopupLayout
                    className="h-full sm:h-[55vh] gap-2"
                    onBack={onCancel}
                    title={
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormControl>
                                        <Input
                                            placeholder={t(
                                                "please-enter-budget-title",
                                            )}
                                            {...field}
                                            maxLength={50}
                                            className="text-center"
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    }
                >
                    <div className="flex-1 w-full overflow-y-auto flex flex-col px-4 gap-2 pb-20">
                        {/* 日期选择 */}
                        <div className="flex gap-4">
                            <FormField
                                control={form.control}
                                name="start"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col flex-1">
                                        <FormLabel>{t("start-date")}</FormLabel>
                                        <Popover>
                                            <FormControl>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value &&
                                                                "text-muted-foreground",
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            field.value.toLocaleDateString()
                                                        ) : (
                                                            <span>
                                                                {t(
                                                                    "please-select-start-date",
                                                                )}
                                                            </span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                            </FormControl>
                                            <PopoverContent
                                                className="w-auto min-h-[265px] p-3"
                                                align="start"
                                            >
                                                <Calendar
                                                    className="min-w-[240px] rounded-md p-0"
                                                    mode="single"
                                                    captionLayout="dropdown"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) =>
                                                        date > new Date() ||
                                                        date <
                                                            new Date(
                                                                "1900-01-01",
                                                            )
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="end"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col flex-1">
                                        <FormLabel>
                                            {t("end-date-optional")}
                                        </FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value &&
                                                                "text-muted-foreground",
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            field.value.toLocaleDateString()
                                                        ) : (
                                                            <span>
                                                                {t(
                                                                    "please-select-end-date",
                                                                )}
                                                            </span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent
                                                className="w-auto min-h-[265px] p-4"
                                                align="end"
                                            >
                                                <Calendar
                                                    mode="single"
                                                    captionLayout="dropdown"
                                                    className="min-w-[240px] rounded-md p-0"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    disabled={(date) =>
                                                        date <
                                                        form.getValues("start")
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        {/* 参与者选择 */}
                        <FormField
                            control={form.control}
                            name="joiners"
                            render={() => (
                                <FormItem>
                                    <FormLabel>{t("participants")}</FormLabel>
                                    <FormDescription>
                                        {t("select-all-participants")}
                                    </FormDescription>
                                    {joiners.map((item) => (
                                        <FormField
                                            key={item.id}
                                            control={form.control}
                                            name="joiners"
                                            render={({ field }) => {
                                                return (
                                                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value?.includes(
                                                                    item.id,
                                                                )}
                                                                onCheckedChange={(
                                                                    checked,
                                                                ) => {
                                                                    return checked
                                                                        ? field.onChange(
                                                                              [
                                                                                  ...field.value,
                                                                                  item.id,
                                                                              ],
                                                                          )
                                                                        : field.onChange(
                                                                              field.value?.filter(
                                                                                  (
                                                                                      value,
                                                                                  ) =>
                                                                                      value !==
                                                                                      item.id,
                                                                              ),
                                                                          );
                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="font-normal">
                                                            {item.name}
                                                        </FormLabel>
                                                    </FormItem>
                                                );
                                            }}
                                        />
                                    ))}
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        {/* 总预算 */}
                        <FormField
                            control={form.control}
                            name="totalBudget"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("total-budget")}</FormLabel>
                                    <FormControl>
                                        <Input
                                            type="number"
                                            placeholder={t(
                                                "please-enter-total-budget",
                                            )}
                                            {...field}
                                            onChange={(event) => {
                                                field.onChange(
                                                    event.target.valueAsNumber,
                                                );
                                            }}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="flex justify-between items-center gap-2">
                            <FormField
                                control={form.control}
                                name="onlyTags"
                                render={({ field }) => {
                                    // 查找当前选中的tag对象，以便于在按钮上显示它们的名称
                                    const selectedTags = tags.filter((tag) =>
                                        field.value?.includes(tag.id),
                                    );

                                    return (
                                        <FormItem>
                                            <FormLabel>
                                                {t("tags-only")}
                                            </FormLabel>
                                            <FormDescription>
                                                {t("tags-only-description")}
                                            </FormDescription>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between"
                                                        >
                                                            {selectedTags.length >
                                                            0
                                                                ? selectedTags
                                                                      .map(
                                                                          (
                                                                              tag,
                                                                          ) =>
                                                                              tag.name,
                                                                      )
                                                                      .join(
                                                                          ", ",
                                                                      )
                                                                : t("none")}
                                                        </Button>
                                                    </FormControl>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="w-full"
                                                >
                                                    {tags.map((tag) => (
                                                        <DropdownMenuCheckboxItem
                                                            key={tag.id}
                                                            // 检查当前项的id是否在field.value数组中
                                                            checked={
                                                                field.value?.includes(
                                                                    tag.id,
                                                                ) ?? false
                                                            }
                                                            // 当选中状态改变时，更新form的值
                                                            onCheckedChange={(
                                                                checked,
                                                            ) => {
                                                                const currentValue =
                                                                    field.value ||
                                                                    [];
                                                                if (checked) {
                                                                    // 如果勾选，添加id到数组
                                                                    field.onChange(
                                                                        [
                                                                            ...currentValue,
                                                                            tag.id,
                                                                        ],
                                                                    );
                                                                } else {
                                                                    // 如果取消勾选，从数组中移除id
                                                                    field.onChange(
                                                                        currentValue.filter(
                                                                            (
                                                                                value,
                                                                            ) =>
                                                                                value !==
                                                                                tag.id,
                                                                        ),
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {tag.name}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />
                            <FormField
                                control={form.control}
                                name="excludeTags"
                                render={({ field }) => {
                                    // 查找当前选中的tag对象，以便于在按钮上显示它们的名称
                                    const selectedTags = tags.filter((tag) =>
                                        field.value?.includes(tag.id),
                                    );

                                    return (
                                        <FormItem>
                                            <FormLabel>
                                                {t("tags-excluded")}
                                            </FormLabel>
                                            <FormDescription>
                                                {t("tags-excluded-description")}
                                            </FormDescription>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild>
                                                    <FormControl>
                                                        <Button
                                                            variant="outline"
                                                            role="combobox"
                                                            className="w-full justify-between"
                                                        >
                                                            {selectedTags.length >
                                                            0
                                                                ? selectedTags
                                                                      .map(
                                                                          (
                                                                              tag,
                                                                          ) =>
                                                                              tag.name,
                                                                      )
                                                                      .join(
                                                                          ", ",
                                                                      )
                                                                : t("none")}
                                                        </Button>
                                                    </FormControl>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent
                                                    align="end"
                                                    className="w-full"
                                                >
                                                    {tags.map((tag) => (
                                                        <DropdownMenuCheckboxItem
                                                            key={tag.id}
                                                            // 检查当前项的id是否在field.value数组中
                                                            checked={
                                                                field.value?.includes(
                                                                    tag.id,
                                                                ) ?? false
                                                            }
                                                            // 当选中状态改变时，更新form的值
                                                            onCheckedChange={(
                                                                checked,
                                                            ) => {
                                                                const currentValue =
                                                                    field.value ||
                                                                    [];
                                                                if (checked) {
                                                                    // 如果勾选，添加id到数组
                                                                    field.onChange(
                                                                        [
                                                                            ...currentValue,
                                                                            tag.id,
                                                                        ],
                                                                    );
                                                                } else {
                                                                    // 如果取消勾选，从数组中移除id
                                                                    field.onChange(
                                                                        currentValue.filter(
                                                                            (
                                                                                value,
                                                                            ) =>
                                                                                value !==
                                                                                tag.id,
                                                                        ),
                                                                    );
                                                                }
                                                            }}
                                                        >
                                                            {tag.name}
                                                        </DropdownMenuCheckboxItem>
                                                    ))}
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                            <FormMessage />
                                        </FormItem>
                                    );
                                }}
                            />
                        </div>

                        <div className="flex flex-col gap-2 rounded-md border p-4">
                            <h3 className="text-lg font-medium">
                                {t("period")}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {t("set-budget-period")}
                            </p>
                            <div className="flex items-center justify-between">
                                <div>{t("every")}:</div>
                                <div className="flex items-center gap-2">
                                    <FormField
                                        control={form.control}
                                        name="repeat.value"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        step="1"
                                                        className="text-end"
                                                        placeholder="xx"
                                                        {...field}
                                                        onChange={(event) => {
                                                            field.onChange(
                                                                event.target
                                                                    .valueAsNumber,
                                                            );
                                                        }}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="repeat.unit"
                                        render={({ field }) => (
                                            <FormItem className="space-y-0">
                                                <Select
                                                    onValueChange={
                                                        field.onChange
                                                    }
                                                    defaultValue={field.value}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue
                                                                placeholder={t(
                                                                    "period-unit",
                                                                )}
                                                            />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent align="end">
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
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 分类预算列表 */}
                        <div className="flex flex-col gap-2 rounded-md border p-4">
                            <h3 className="text-lg font-medium">
                                {t("categories-budget")}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {t("categories-budget-description")}
                            </p>
                            {fields.map((field, index) => (
                                <div
                                    key={field.id}
                                    className="flex gap-4 justify-center items-center"
                                >
                                    <div className="flex-1">
                                        <FormField
                                            control={form.control}
                                            name={`categoriesBudget.${index}.id`}
                                            render={({
                                                field: categoryField,
                                            }) => (
                                                <FormItem className="space-y-0">
                                                    <FormLabel>
                                                        {t("categories")}
                                                    </FormLabel>
                                                    <CascadeSelect
                                                        align="end"
                                                        value={
                                                            categoryField.value
                                                        }
                                                        onValueChange={
                                                            categoryField.onChange
                                                        }
                                                        list={categoryOption}
                                                    ></CascadeSelect>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <div className="flex-1">
                                        <FormField
                                            control={form.control}
                                            name={`categoriesBudget.${index}.budget`}
                                            render={({
                                                field: budgetField,
                                            }) => (
                                                <FormItem>
                                                    <FormLabel>
                                                        {t("budget-money")}
                                                    </FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            placeholder={t(
                                                                "please-enter-budget-money",
                                                            )}
                                                            {...budgetField}
                                                            onChange={(
                                                                event,
                                                            ) => {
                                                                budgetField.onChange(
                                                                    event.target
                                                                        .valueAsNumber,
                                                                );
                                                            }}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        size="icon"
                                        onClick={() => remove(index)}
                                        className="self-end"
                                    >
                                        <X className="h-4 w-4" />
                                    </Button>
                                </div>
                            ))}
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="mt-2"
                                onClick={() => append({ id: "", budget: 0 })}
                            >
                                <Plus className="h-4 w-4 mr-2" />
                                {t("add-categories-budget")}
                            </Button>
                        </div>
                    </div>
                    <div className="p-2 w-full flex justify-end">
                        <Button type="submit" className="sm:w-fit w-full">
                            {t("confirm")}
                        </Button>
                    </div>
                </PopupLayout>
            </form>
        </Form>
    );
}
