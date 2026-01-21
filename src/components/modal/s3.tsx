import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";

export type S3Edit = {
    endpoint: string;
    region: string;
    accessKeyId: string;
    secretAccessKey: string;
    bucket: string;
    baseDir?: string;
    forcePathStyle?: boolean;
    sessionToken?: string;
    customUserName?: string;
};

type LoadingState = Partial<S3Edit> & {
    check?: (v: S3Edit) => Promise<unknown>;
};

export const createFormSchema = (t: any) =>
    z.object({
        endpoint: z
            .string()
            .check(z.minLength(1, { message: t("s3-endpoint-required") })),
        region: z
            .string()
            .check(z.minLength(1, { message: t("s3-region-required") })),
        accessKeyId: z
            .string()
            .check(z.minLength(1, { message: t("s3-access-key-required") })),
        secretAccessKey: z
            .string()
            .check(z.minLength(1, { message: t("s3-secret-key-required") })),
        bucket: z
            .string()
            .check(z.minLength(1, { message: t("s3-bucket-required") })),
        baseDir: z.optional(z.string()),
        forcePathStyle: z.optional(z.boolean()),
        sessionToken: z.optional(z.string()),
        customUserName: z.optional(z.string()),
    });

const LoadingForm = ({
    edit,
    onConfirm,
    onCancel,
}: {
    edit?: LoadingState;
    onCancel?: () => void;
    onConfirm?: (v?: LoadingState) => void;
}) => {
    const t = useIntl();
    const formSchema = useMemo(() => createFormSchema(t), [t]);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema) as any,
        defaultValues: {
            baseDir: "cent",
            forcePathStyle: false,
            sessionToken: "",
        },
    });
    const [checking, setChecking] = useState(false);
    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        // 移除末尾的斜杠
        data.endpoint = data.endpoint.replace(/\/$/, "");
        setChecking(true);
        try {
            await edit?.check?.(data as S3Edit);
            onConfirm?.(data as S3Edit);
        } finally {
            setChecking(false);
        }
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
            <div className="flex py-4 items-center gap-1 text-sm font-medium">
                {t("sync-with-s3")}
            </div>
            <Form {...form}>
                <div className="w-full flex-1 flex flex-col gap-4 px-4 overflow-y-auto">
                    <FormField
                        control={form.control}
                        name="endpoint"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("s3-endpoint")}</div>
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="https://s3.amazonaws.com"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="region"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("s3-region")}</div>
                                </FormLabel>
                                <FormControl>
                                    <Input placeholder="us-east-1" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="accessKeyId"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("s3-access-key-id")}</div>
                                </FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="secretAccessKey"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("s3-secret-access-key")}</div>
                                </FormLabel>
                                <FormControl>
                                    <Input {...field} type="password" />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="bucket"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("s3-bucket")}</div>
                                </FormLabel>
                                <FormControl>
                                    <Input placeholder="my-bucket" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="baseDir"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("s3-base-dir")}</div>
                                </FormLabel>
                                <FormControl>
                                    <Input placeholder="cent" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <div className="flex flex-col gap-4 rounded-md border p-2">
                        <div className="text-sm font-medium">
                            {t("s3-advanced-options")}
                        </div>
                        <FormField
                            control={form.control}
                            name="forcePathStyle"
                            render={({ field }) => (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                    <FormControl>
                                        <Checkbox
                                            checked={field.value}
                                            onCheckedChange={field.onChange}
                                        />
                                    </FormControl>
                                    <div className="space-y-1 leading-none">
                                        <FormLabel>
                                            {t("s3-force-path-style")}
                                        </FormLabel>
                                    </div>
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="sessionToken"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel asChild>
                                        <div>{t("s3-session-token")}</div>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={t(
                                                "s3-session-token-placeholder",
                                            )}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                    {/* 使用 S3 时，用户可能会将一个 S3 配置分享给其他人使用，达成共享的效果，此时需要允许用户填写一个自定义昵称作为不同用户的区分 */}
                    <div className="flex flex-col gap-4 rounded-md border p-2">
                        <div className="text-sm font-medium">
                            {t("custom-user")}
                        </div>
                        <FormField
                            control={form.control}
                            name="customUserName"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel asChild>
                                        <div className="flex items-center gap-1">
                                            {t("custom-user-name")}
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <i className="icon-[mdi--help-circle-outline] cursor-pointer"></i>
                                                </PopoverTrigger>
                                                <PopoverContent className="text-xs p-2">
                                                    <p>
                                                        {t(
                                                            "custom-user-name-tooltip",
                                                        )}
                                                    </p>
                                                </PopoverContent>
                                            </Popover>
                                        </div>
                                    </FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder={t(
                                                "custom-user-name-placeholder",
                                            )}
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                    </div>
                </div>

                <div className="p-4 w-full flex justify-end gap-2">
                    <Button
                        variant={"ghost"}
                        className="sm:w-fit w-full"
                        onClick={onCancel}
                    >
                        {t("cancel")}
                    </Button>
                    <Button
                        className="sm:w-fit w-full"
                        type="submit"
                        disabled={checking}
                        onClick={() => {
                            form.handleSubmit(onSubmit)();
                        }}
                    >
                        {t("confirm")}
                    </Button>
                </div>
            </Form>
        </div>
    );
};

export const [S3AuthProvider, showS3Auth] = createConfirmProvider(LoadingForm, {
    dialogTitle: "loading",
    dialogModalClose: true,
    contentClassName: "w-[400px] h-[600px] z-[2]",
    fade: true,
});
