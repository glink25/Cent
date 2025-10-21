import { VisuallyHidden } from "radix-ui";
import { type ReactNode, useCallback } from "react";
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
import { confirmStoreFactory } from "./state";

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
    const useStore = confirmStoreFactory<Value, Returned>();
    function Confirm() {
        const [visible, editBill, controller] = useStore(
            useShallow((state) => {
                return [state.visible, state.edit, state.controller];
            }),
        );
        // if (!visible) {
        // 	return null;
        // }

        const onCancel = () => {
            controller?.reject();
            useStore
                .getState()
                .update({ visible: false, controller: undefined });
        };
        const onConfirm = (v: Returned) => {
            controller?.resolve(v);
            useStore
                .getState()
                .update({ visible: false, controller: undefined });
        };
        return (
            <Dialog
                open={visible}
                onOpenChange={(v) => {
                    // if (dialogModalClose && !v) {
                    //     onCancel();
                    // }
                    if (!v) {
                        onCancel();
                    }
                }}
            >
                <DialogPortal>
                    <DialogOverlay className="fixed inset-0 bg-black/50" />
                    <div className="fixed top-0 left-0 w-full h-full flex justify-center items-center pointer-events-none">
                        <DialogContent
                            fade={fade}
                            swipe={swipe}
                            className={cn(
                                "pointer-events-auto bg-background max-h-[55vh] w-[90vw] max-w-[500px] rounded-md",
                                contentClassName,
                            )}
                            onOpenAutoFocus={useCallback((e: Event) => {
                                (
                                    document.activeElement as HTMLElement
                                )?.blur?.();
                                e.preventDefault();
                            }, [])}
                            onInteractOutside={useCallback(
                                (e: Event) => {
                                    if (!dialogModalClose) {
                                        e.preventDefault();
                                    }
                                },
                                [dialogModalClose],
                            )}
                        >
                            <VisuallyHidden.Root>
                                <DialogTitle>{dialogTitle}</DialogTitle>
                                <DialogDescription>
                                    {dialogDescription}
                                </DialogDescription>
                            </VisuallyHidden.Root>
                            <Form
                                edit={editBill}
                                onCancel={onCancel}
                                onConfirm={onConfirm}
                            />
                        </DialogContent>
                    </div>
                </DialogPortal>
            </Dialog>
        );
    }

    const confirm = useStore.getState().open;

    return [Confirm, confirm] as const;
}
