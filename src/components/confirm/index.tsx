import { VisuallyHidden } from "radix-ui";
import { type ReactNode, useEffect } from "react";
import { useShallow } from "zustand/shallow";
import { cn } from "@/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogOverlay,
    DialogPortal,
    DialogTitle,
} from "../ui/dialog";
import { useGlobalConfirmStore } from "./state"; // 引入上面创建的全局 store

export default function createConfirmProvider<Value, Returned = Value>(
    Form: (props: {
        edit?: Value;
        onCancel?: () => void;
        onConfirm?: (v: Returned) => void;
    }) => ReactNode,
    {
        dialogTitle,
        dialogDescription = dialogTitle,
        dialogModalClose,
        contentClassName,
        fade,
        swipe,
    }: {
        dialogTitle: string | ReactNode;
        dialogDescription?: string | ReactNode;
        dialogModalClose?: boolean;
        contentClassName?: string;
        fade?: boolean;
        swipe?: boolean;
    },
) {
    // 1. 为每个 Provider 实例生成一个唯一的 ID (在闭包中唯一)
    const instanceId = `confirm_${Math.random().toString(36).slice(2, 9)}`;

    function Confirm() {
        // 2. 仅监听属于自己 ID 的那部分状态
        const state = useGlobalConfirmStore(
            useShallow((s) => s.instances[instanceId]),
        );

        // 3. 组件卸载时清理全局 Store 中的数据，避免内存泄漏
        useEffect(() => {
            return () => useGlobalConfirmStore.getState().remove(instanceId);
        }, []);
        // 如果该实例还未初始化（从未调用过 open），则不渲染
        if (!state) return null;

        const { visible, edit, controller } = state;

        const onCancel = () => {
            controller?.cancel();
        };

        const onConfirm = (v: Returned) => {
            controller?.resolve(v);
            useGlobalConfirmStore.getState().update(instanceId, {
                visible: false,
                controller: undefined,
            });
        };

        return (
            <Dialog
                open={visible}
                onOpenChange={(v) => {
                    if (!v) onCancel();
                }}
            >
                <DialogPortal>
                    <DialogOverlay className="fixed inset-0 bg-black/50 z-[2]" />
                    <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center pointer-events-none z-[2]">
                        <DialogContent
                            fade={fade}
                            swipe={swipe}
                            className={cn(
                                "pointer-events-auto bg-background max-h-[55vh] w-[90vw] max-w-[500px] rounded-md overflow-y-auto",
                                contentClassName,
                            )}
                            onOpenAutoFocus={(e) => {
                                (
                                    document.activeElement as HTMLElement
                                )?.blur?.();
                                e.preventDefault();
                            }}
                            onInteractOutside={(e) => {
                                if (!dialogModalClose) e.preventDefault();
                            }}
                        >
                            <VisuallyHidden.Root>
                                <DialogTitle>{dialogTitle}</DialogTitle>
                                <DialogDescription>
                                    {dialogDescription}
                                </DialogDescription>
                            </VisuallyHidden.Root>
                            <Form
                                edit={edit}
                                onCancel={onCancel}
                                onConfirm={onConfirm}
                            />
                        </DialogContent>
                    </div>
                </DialogPortal>
            </Dialog>
        );
    }

    // 4. 暴露的 open 方法封装了 instanceId
    const confirm = (value?: Value) => {
        const [promise, cancel] = useGlobalConfirmStore
            .getState()
            .open<Value, Returned>(instanceId, value);
        return promise;
    };

    return [Confirm, confirm] as const;
}
