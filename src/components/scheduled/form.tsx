import { zodResolver } from "@hookform/resolvers/zod";
import dayjs from "dayjs";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import { v4 } from "uuid";
import * as z from "zod/mini";
import { useShallow } from "zustand/shallow";
import { Calendar } from "@/components/ui/calendar";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { fillScheduledBills } from "@/hooks/use-scheduled";
import PopupLayout from "@/layouts/popup-layout";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import type { EditBill } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { showBillEditor } from "../bill-editor";
import BillItem from "../ledger/item";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";
import { Switch } from "../ui/switch";
import type { Scheduled } from "./type";

const createFormSchema = (t: any) =>
    z.object({
        title: z.string(),
        start: z.date({ error: t("please-select-start-date") }),
        end: z.optional(z.date()),
        enabled: z.optional(z.boolean()),
        template: z.refine((val) => val !== undefined && val !== null, {
            message: t("scheduled-template-validate"),
        }),
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
    });

type EditScheduled = Omit<Scheduled, "id"> & { id?: string };

export default function ScheduledEditForm({
    edit,
    onConfirm,
    onCancel,
}: {
    edit?: EditScheduled;
    onConfirm?: (v?: EditScheduled & { needBills?: EditBill[] }) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const formSchema = useMemo(() => createFormSchema(t), [t]);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: edit
            ? {
                  ...edit,
                  start: edit.start
                      ? dayjs.unix(edit.start / 1000).toDate()
                      : new Date(),
                  end: edit.end
                      ? dayjs.unix(edit.end / 1000).toDate()
                      : undefined,
              }
            : {
                  title: t("new-scheduled"),
                  start: new Date(),
                  enabled: false,
                  repeat: {
                      value: 1,
                      unit: "month",
                  },
              },
    });
    const isCreate = edit === undefined;

    async function onSubmit(data: z.infer<typeof formSchema>) {
        const id = edit?.id ?? `scheduled-${v4()}`;

        const formatted = {
            ...data,
            start: data.start.getTime(),
            end: data.end ? data.end.getTime() : undefined,
            latest: edit?.latest,
            id,
        } as Scheduled & { needBills?: EditBill[] };
        if (formatted.enabled) {
            const needBills = await fillScheduledBills(formatted);
            if (needBills.length > 0) {
                const ok = confirm(
                    t("scheduled-lack-bills", {
                        n: needBills.length,
                    }),
                );
                if (ok) {
                    formatted.latest = Date.now() + 1;
                    formatted.needBills = needBills;
                }
            }
        }
        onConfirm?.(formatted);
    }

    return (
        <Form {...form}>
            <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="h-full w-full"
            >
                <PopupLayout
                    onBack={onCancel}
                    title={t("scheduled-edit")}
                    className="h-full sm:h-[55vh] gap-2"
                >
                    <div className="flex-1 w-full overflow-y-auto flex flex-col px-4 gap-2 pb-20">
                        <FormField
                            control={form.control}
                            name="title"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("scheduled-name")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

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
                                                        className="w-full pl-3 text-left font-normal"
                                                    >
                                                        {field.value
                                                            ? field.value.toLocaleDateString()
                                                            : t(
                                                                  "please-select-start-date",
                                                              )}
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
                                            <FormControl>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className="w-full pl-3 text-left font-normal"
                                                    >
                                                        {field.value
                                                            ? field.value.toLocaleDateString()
                                                            : t(
                                                                  "please-select-end-date",
                                                              )}
                                                    </Button>
                                                </PopoverTrigger>
                                            </FormControl>
                                            <PopoverContent
                                                className="w-auto min-h-[265px] p-3"
                                                align="end"
                                            >
                                                <Calendar
                                                    className="min-w-[240px] rounded-md p-0"
                                                    mode="single"
                                                    captionLayout="dropdown"
                                                    selected={field.value}
                                                    onSelect={field.onChange}
                                                    endMonth={
                                                        new Date(
                                                            new Date().getFullYear() +
                                                                10,
                                                            11,
                                                        )
                                                    }
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

                        <div className="flex">
                            <FormField
                                control={form.control}
                                name="template"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col flex-1">
                                        <FormLabel>
                                            {t("scheduled-template")}
                                        </FormLabel>
                                        <FormControl>
                                            <BillTemplate
                                                value={field.value as any}
                                                onChange={field.onChange}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <div className="flex flex-col gap-2 rounded-md border p-4">
                            <h3 className="text-lg font-medium">
                                {t("period")}
                            </h3>
                            <p className="text-sm text-muted-foreground">
                                {t("set-scheduled-period")}
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

                        <FormField
                            control={form.control}
                            name="enabled"
                            render={({ field }) => (
                                <FormItem className="flex items-center justify-between">
                                    <FormLabel>
                                        {t("scheduled-enabled")}
                                    </FormLabel>
                                    <FormControl>
                                        <Switch
                                            checked={!!field.value}
                                            onCheckedChange={(v) =>
                                                field.onChange(!!v)
                                            }
                                        />
                                    </FormControl>
                                </FormItem>
                            )}
                        />
                    </div>
                    <div className="px-4 py-4 flex gap-2 justify-end">
                        <div>
                            <Button type="submit" className="flex-1">
                                {t("confirm")}
                            </Button>
                        </div>
                    </div>
                </PopupLayout>
            </form>
        </Form>
    );
}

function BillTemplate({
    className,
    value,
    onChange,
}: {
    className?: string;
    value?: Omit<Bill, "id" | "creatorId">;
    onChange?: (v: Omit<Bill, "id" | "creatorId">) => void;
}) {
    const toUpdate = async (v?: Omit<Bill, "id">) => {
        const bill = await showBillEditor(v);
        onChange?.(bill);
    };

    const userId = useUserStore(useShallow((state) => state.id));
    return (
        <div
            className={cn(
                "border rounded-md w-full flex justify-center items-center",
                className,
            )}
        >
            {value === undefined ? (
                <Button
                    className="w-full"
                    onClick={() => toUpdate()}
                    variant={"ghost"}
                >
                    <i className="icon-[mdi--plus] size-5"></i>
                </Button>
            ) : (
                <BillItem
                    className="w-full"
                    bill={{ ...value, id: "template", creatorId: userId }}
                    onClick={() =>
                        toUpdate({
                            ...value,
                            creatorId: userId,
                        })
                    }
                />
            )}
        </div>
    );
}
