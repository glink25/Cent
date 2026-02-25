import {
    type DetailedHTMLProps,
    type InputHTMLAttributes,
    type ReactNode,
    useEffect,
    useRef,
} from "react";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import IOSUnscrolledInput from "../input";
import { Button } from "../ui/button";

// 简易对话框，调用后弹出对话框，包含取消和确定按钮，点击取消将会reject promise，点击确认则会resolve，值取决于对话框中input的值
type PromptOptions = {
    title: ReactNode;
    // 可以指定input的属性，如果input为undefined，则不会显示input
    input?: DetailedHTMLProps<
        InputHTMLAttributes<HTMLInputElement>,
        HTMLInputElement
    >;
    onConfirm?: (v: HTMLInputElement | null) => Promise<void> | void;
    cancellable?: boolean;
};

const PromptForm = ({
    edit,
    onConfirm,
    onCancel,
}: {
    edit?: PromptOptions;
    onCancel?: () => void;
    onConfirm?: (v?: unknown) => void;
}) => {
    const t = useIntl();
    const inputRef = useRef<HTMLInputElement>(null);
    const autoFocus = edit?.input?.autoFocus !== false;
    useEffect(() => {
        if (autoFocus) {
            inputRef.current?.focus();
        }
    }, [autoFocus]);
    return (
        <div className="w-full h-full flex flex-col p-4">
            <div className="flex-1 flex flex-col gap-2">
                {edit?.title}
                {edit?.input && (
                    <IOSUnscrolledInput
                        ref={inputRef}
                        className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
                        {...edit.input}
                    />
                )}

                <div className="w-full flex gap-2 pt-2 items-center justify-end">
                    {edit?.cancellable !== false && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                                onCancel?.();
                            }}
                        >
                            {t("cancel")}
                        </Button>
                    )}
                    <Button
                        size="sm"
                        onClick={async () => {
                            const value = await edit?.onConfirm?.(
                                inputRef.current,
                            );
                            onConfirm?.(value ?? inputRef.current?.value);
                        }}
                    >
                        {t("confirm")}
                    </Button>
                </div>
            </div>
        </div>
    );
};

export const [PromptProvider, showPrompt] = createConfirmProvider(PromptForm, {
    dialogTitle: "prompt",
    dialogModalClose: false,
    contentClassName: "w-[360px] h-fit",
    fade: true,
});

export const prompt = (v: PromptOptions) => {
    return showPrompt(v);
};
