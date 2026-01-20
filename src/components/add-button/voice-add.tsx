import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { useLongPress } from "@/hooks/use-long-press";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { parseTextToBill } from "../assistant/text-to-bill";
import createConfirmProvider from "../confirm";
import { BaseButton } from "./base";
import { startRecognize } from "./recognize";
import VoiceForm, { VoiceFormContext, type VoiceFormState } from "./voice-form";

const [VoiceFormProvider, , showVoiceForm] = createConfirmProvider(VoiceForm, {
    dialogTitle: t("voice-recording-dialog-title"),
    dialogModalClose: false,
    fade: true,
    swipe: false,
});

export function VoiceAddButton({ onClick }: { onClick?: () => void }) {
    const cancelRef = useRef<(() => void) | undefined>(undefined);
    const stopRef = useRef<(() => void) | undefined>(undefined);

    const [formState, setFormState] = useState<VoiceFormState>({
        text: "",
        phase: "listening",
    });

    const presses = useLongPress({
        onClick,
        onLongPressStart: useCallback(async () => {
            const { promise: dialogClosed, cancel: closeDialog } =
                showVoiceForm();
            const {
                finished,
                cancel: cancelRecognizing,
                stop: stopRecognizing,
            } = startRecognize((text) => {
                setFormState((prev) => ({ ...prev, text }));
            });

            dialogClosed.catch((error) => {
                console.warn(error);
                cancelRecognizing();
            });

            cancelRef.current = closeDialog;
            stopRef.current = stopRecognizing;

            try {
                const value = await finished;
                const text = value.trim();
                if (text.length === 0) {
                    return;
                }
                setFormState((prev) => ({ ...prev, phase: "parsing" }));
                const bills = await parseTextToBill(text);
                if (bills.length === 0) {
                    return;
                }
                await useLedgerStore.getState().addBills(bills);
                toast.success(t("voice-add-success", { count: bills.length }));
            } catch (error) {
                console.error(error);
                toast.error(
                    t("voice-recognition-failed", {
                        error: error instanceof Error ? error.message : "",
                    }),
                );
            } finally {
                closeDialog();
            }
        }, []),
        onLongPressEnd: useCallback(() => {
            console.log("start parsing voice texts");
            stopRef.current?.();
            cancelRef.current = undefined;
            stopRef.current = undefined;
        }, []),
        onLongPressCancel: useCallback(() => {
            cancelRef.current?.();
            cancelRef.current = undefined;
        }, []),
    });

    return (
        <VoiceFormContext.Provider value={formState}>
            <BaseButton {...presses?.()}>
                <i className="icon-[mdi--microphone-plus] text-[white] size-7"></i>
            </BaseButton>
            <VoiceFormProvider />
        </VoiceFormContext.Provider>
    );
}
