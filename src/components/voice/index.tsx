import { useRef } from "react";
import { useLongPress } from "@/hooks/use-long-press";
import createConfirmProvider from "../confirm";
import VoiceForm from "./voice-form";

const [VoiceFormProvider, , showVoiceForm] = createConfirmProvider(VoiceForm, {
    dialogTitle: "voice recording",
    dialogModalClose: true,
    fade: true,
    swipe: false,
});

export default function VoiceAddButton({ onClick }: { onClick?: () => void }) {
    const cancelRef = useRef<(() => void) | undefined>(undefined);
    const presses = useLongPress({
        onClick,
        onLongPressStart: () => {
            const { cancel } = showVoiceForm();
            cancelRef.current = cancel;
        },
        onLongPressEnd: () => {
            console.log("start parsing voice texts");
            cancelRef.current = undefined;
        },
        onLongPressCancel: () => {
            cancelRef.current?.();
            cancelRef.current = undefined;
        },
    });

    return (
        <>
            <button
                type="button"
                className="w-18 h-18 sm:w-14 sm:h-14 rounded-full bg-stone-900 shadow-md flex items-center justify-center m-1 cursor-pointer transform transition-all hover:scale-105"
                {...presses?.()}
            >
                <i className="icon-[mdi--microphone-plus] text-[white] size-7"></i>
            </button>
            <VoiceFormProvider />
        </>
    );
}
