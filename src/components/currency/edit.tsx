import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { useCurrency } from "@/hooks/use-currency";
import type { CustomCurrency } from "@/ledger/type";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel } from "../ui/form";
import { Input } from "../ui/input";

export const createFormSchema = (t: any) =>
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

const EditCurrencyForm = ({
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
                        render={({ field }) => {
                            return (
                                <FormItem>
                                    <FormLabel>{t("rate-to-base")}</FormLabel>
                                    <div className="flex gap-2 items-center">
                                        <div> 1 {baseCurrency.label} = </div>
                                        <FormControl>
                                            <Input
                                                className="flex-1"
                                                {...field}
                                            />
                                        </FormControl>
                                        <div>
                                            {form.getValues("name") ||
                                                t("default-currency-name")}
                                        </div>
                                    </div>
                                </FormItem>
                            );
                        }}
                    ></FormField>
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

export const [EditCurrencyProvider, showEditCurrency] = createConfirmProvider(
    EditCurrencyForm,
    {
        dialogTitle: "Edit Currency",
        dialogModalClose: false,
        fade: true,
        swipe: false,
        contentClassName: "w-[350px] h-[480px] max-h-[55vh] py-4",
    },
);
