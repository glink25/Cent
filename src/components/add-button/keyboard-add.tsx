import { useCallback } from "react";
import { useLongPress } from "@/hooks/use-long-press";
import createConfirmProvider from "../confirm";
import { BaseButton } from "./base";
import KeyboardForm from "./keyboard-form";

const [KeyboardFormProvider, showKeyboardForm] = createConfirmProvider(
    KeyboardForm,
    {
        dialogTitle: "text input",
        dialogModalClose: false,
        fade: true,
        swipe: false,
    },
);

export function KeyboardAddButton({ onClick }: { onClick?: () => void }) {
    const presses = useLongPress({
        onClick,
        onLongPressStart: useCallback(async () => {
            const finished = showKeyboardForm();
            return finished;
        }, []),
    });

    return (
        <>
            <BaseButton className="relative" {...presses?.()}>
                <i className="icon-[mdi--add] text-[white] size-7 -translate-x-1 -translate-y-1"></i>
                <i className="icon-[mdi--keyboard] text-[white] size-4 absolute translate-x-2 translate-y-2"></i>
            </BaseButton>
            <KeyboardFormProvider />
        </>
    );
}
