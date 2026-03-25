import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { useCurrency } from "@/hooks/use-currency";
import type { CustomCurrency } from "@/ledger/type";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { Input } from "../ui/input";
import RateInput from "./rate-input";

const createFormSchema = (t: any) =>
    z.object({
        name: z.string().check(
            z.maxLength(50, {
                message: t("max-name-length-limit", { n: 50 }),
            }),
        ),
        // 可选字符串
        symbol: z.string().check(
            z.maxLength(5, {
                message: t("max-name-length-limit", { n: 5 }),
            }),
        ),
        rateToBase: z.coerce
            .number()
            .check(z.gte(0, { message: t("rate-must-positive") })),
    });

type CurrencyEdit = Omit<CustomCurrency, "id"> & { id?: string };

export const EditCurrencyForm = ({
    edit,
    onConfirm,
    onCancel,
}: {
    edit?: CurrencyEdit;
    onConfirm?: (v: CurrencyEdit | "delete") => void;
    onCancel?: () => void;
}) => {
    const t = useIntl();
    const { baseCurrency } = useCurrency();
    const formSchema = useMemo(() => createFormSchema(t), [t]);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: edit,
    });
    const isCreate = edit === undefined;

    const toSubmit = () => {
        const onSubmit = (data: z.infer<typeof formSchema>) => {
            onConfirm?.({ ...data, id: edit?.id });
        };
        form.handleSubmit(onSubmit)();
    };
    return (
        <Form {...form}>
            <div className="w-full h-full flex flex-col">
                <div className="px-4 text-center">
                    {isCreate ? t("add-new-currency") : t("edit-currency")}
                </div>
                <div className="px-4 flex flex-1 flex-col gap-4 overflow-y-auto">
                    <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => {
                            return (
                                <FormItem>
                                    <FormLabel>{t("currency-name")}</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={t(
                                                "custom-currency-name-placeholder",
                                            )}
                                            {...field}
                                            maxLength={50}
                                        />
                                    </FormControl>
                                </FormItem>
                            );
                        }}
                    ></FormField>

                    <FormField
                        control={form.control}
                        name="symbol"
                        render={({ field }) => {
                            return (
                                <FormItem>
                                    <FormLabel>
                                        {t("currency-symbol")}
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={t(
                                                "custom-currency-symbol-placeholder",
                                            )}
                                            {...field}
                                            maxLength={5}
                                        />
                                    </FormControl>
                                </FormItem>
                            );
                        }}
                    ></FormField>

                    <FormField
                        control={form.control}
                        name="rateToBase"
                        render={({ field }) => (
                            <FormItem className="space-y-3">
                                {/* 这里的 FormLabel 可以保留，或者直接使用组件内部的 label */}
                                <FormLabel>{t("rate-to-base")}</FormLabel>
                                <FormControl>
                                    <RateInput
                                        // 基础货币标签（本位币）
                                        baseCurrencyLabel={baseCurrency.label}
                                        // 目标货币标签（当前编辑的币种）
                                        targetCurrencyLabel={
                                            form.watch("name") ||
                                            t("default-currency-name")
                                        }
                                        // 传入 Hook Form 的当前值
                                        value={field.value}
                                        allowClear={false}
                                        // 当 RateInput 内部计算出新汇率时，直接更新 Hook Form
                                        onChange={(newRate) =>
                                            field.onChange(newRate)
                                        }
                                    />
                                </FormControl>
                            </FormItem>
                        )}
                    />
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
