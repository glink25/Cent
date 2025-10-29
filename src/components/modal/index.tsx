import { type ReactNode, useEffect } from "react";
import { toast } from "sonner";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { showWebDAVAuth, WebDAVAuthProvider } from "./web-dav";

type LoadingState = {
    target: EventTarget;
    onCancel?: () => void;
    label?: ReactNode;
};

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
    useEffect(() => {
        const onClose = () => {
            onConfirm?.();
        };
        edit?.target.addEventListener("close", onClose);
        return () => {
            edit?.target?.removeEventListener("close", onClose);
        };
    }, [edit?.target, onConfirm]);
    return (
        <div className="w-full h-full flex flex-col items-center justify-center">
            <div className="flex-1 flex flex-col items-center justify-center gap-2">
                <i className="icon-[mdi--loading] animate-spin size-10"></i>
                {edit?.label}
            </div>
            {edit?.onCancel && (
                <div className="w-full flex items-center p-1 justify-end">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                            edit.onCancel?.();
                            onCancel?.();
                        }}
                    >
                        {t("cancel")}
                    </Button>
                </div>
            )}
        </div>
    );
};

const [LoadingProvider, showLoading] = createConfirmProvider(LoadingForm, {
    dialogTitle: "loading",
    dialogModalClose: false,
    contentClassName: "w-[240px] h-[240px]",
    fade: true,
});

const loading = (v?: Omit<LoadingState, "target">) => {
    const target = new EventTarget();
    const loaded = showLoading({ ...v, target });
    return [
        () => {
            target.dispatchEvent(new CustomEvent("close"));
        },
        loaded,
    ] as const;
};

export function ModalProvider() {
    return (
        <>
            <LoadingProvider />
            <WebDAVAuthProvider />
        </>
    );
}

const modal = {
    loading,
    webDavAuth: showWebDAVAuth,
    toast,
};

export type Modal = typeof modal;

export default modal;
