import { zodResolver } from "@hookform/resolvers/zod";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import * as z from "zod/mini";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
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

export type WebDAVEdit = {
    remote: string;
    username: string;
    password: string;
    proxy?: string;
    customUserName?: string;
};

type LoadingState = Partial<WebDAVEdit> & {
    check?: (v: WebDAVEdit) => Promise<unknown>;
};

export const createFormSchema = (t: any) =>
    z.object({
        remote: z.string(),
        username: z.string(),
        password: z.string(),
        proxy: z.optional(z.string()),
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
            proxy: "", //"https://oncent-backend.linkai.work/proxy?url=",
        },
    });
    const [checking, setChecking] = useState(false);
    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        data.remote = data.remote.replace(/\/$/, "");
        setChecking(true);
        try {
            await edit?.check?.(data);
            onConfirm?.(data);
        } finally {
            setChecking(false);
        }
    };
    return (
        <div className="w-full h-full flex flex-col items-center justify-center overflow-hidden">
            <a
                className="flex py-4 items-center gap-1"
                href="https://glink25.github.io/post/%E9%80%9A%E8%BF%87Web-DAV%E8%BF%9B%E8%A1%8CCent%E6%95%B0%E6%8D%AE%E5%90%8C%E6%AD%A5/"
                target="_blank"
                rel="noopener"
            >
                {t("sync-with-web-dav")}
                <i className="icon-[mdi--question-mark-circle-outline]"></i>
            </a>
            <Form {...form}>
                <div className="w-full flex-1 flex flex-col gap-4 px-4 overflow-y-auto">
                    <FormField
                        control={form.control}
                        name="remote"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("web-dav-remote-url")}</div>
                                </FormLabel>
                                <FormControl>
                                    <Input
                                        placeholder="https://dav.jianguoyun.com/dav/"
                                        {...field}
                                    />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    <FormField
                        control={form.control}
                        name="username"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("username")}</div>
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
                        name="password"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>{t("password")}</div>
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
                        name="proxy"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <a
                                        className="flex items-center gap-1"
                                        href={t("web-dav-proxy-url")}
                                        target="_blank"
                                        rel="noopener"
                                    >
                                        {t("proxy-url")}
                                        <i className="icon-[mdi--question-mark-circle-outline]"></i>
                                    </a>
                                </FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                    {/* 使用webdav时，用户可能会将一个webdav配置分享给其他人使用，达成共享的效果，此时需要允许用户填写一个自定义昵称作为不同用户的区分 */}
                    <div className="flex flex-col gap-4 rounded-md border p-2">
                        <a
                            className="flex items-center gap-1"
                            href={t("web-dav-custom-user")}
                            target="_blank"
                            rel="noopener"
                        >
                            {t("custom-user")}
                            <i className="icon-[mdi--question-mark-circle-outline]"></i>
                        </a>
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
                                        <Input {...field} />
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

export const [WebDAVAuthProvider, showWebDAVAuth] = createConfirmProvider(
    LoadingForm,
    {
        dialogTitle: "loading",
        dialogModalClose: true,
        contentClassName: "w-[350px] h-[480px] z-[2]",
        fade: true,
    },
);
