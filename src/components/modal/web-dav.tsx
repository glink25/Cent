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

type Edit = {
    remote: string;
    username: string;
    password: string;
    proxy?: string;
};

type LoadingState = Partial<Edit> & {
    check?: (v: Edit) => Promise<unknown>;
};

export const createFormSchema = (t: any) =>
    z.object({
        remote: z.string(),
        username: z.string(),
        password: z.string(),
        proxy: z.optional(z.string()),
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
            proxy: "http://localhost:8787/proxy?url=",
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
            <div className="flex py-4">使用Web DAV进行同步</div>
            <Form {...form}>
                <div className="w-full flex-1 flex flex-col gap-2 px-4 overflow-y-auto">
                    <FormField
                        control={form.control}
                        name="remote"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel asChild>
                                    <div>Web DAV地址</div>
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
                                    <div>用户名</div>
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
                                    <div>密码</div>
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
                                    <div>代理地址</div>
                                </FormLabel>
                                <FormControl>
                                    <Input {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="p-4 w-full flex justify-end">
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
        contentClassName: "w-[350px] h-[450px] ",
        fade: true,
    },
);
