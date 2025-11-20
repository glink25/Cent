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

type PromptOptions = {
    title: ReactNode;
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
                    {!edit?.cancellable && (
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
