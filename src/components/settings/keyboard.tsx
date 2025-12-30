import { useEffect, useRef, useState } from "react";
import { useIntl } from "@/locale";
import { usePreferenceStore } from "@/store/preference";

export default function KeyboardHeightSettings() {
    const t = useIntl();
    const [keyboardHeight, setKeyboardHeight] = useState(
        () => usePreferenceStore.getState().keyboardHeight ?? 50,
    );
    const sliderRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const slider = sliderRef.current;
        if (!slider) {
            return;
        }
        const onCommit = (e: Event) => {
            const value = Number((e.target as HTMLInputElement).value);
            usePreferenceStore.setState((prev) => ({
                ...prev,
                keyboardHeight: value,
            }));
        };
        slider.addEventListener("change", onCommit);
        return () => {
            slider.removeEventListener("change", onCommit);
        };
    }, []);
    return (
        <div className="w-full h-10 flex justify-between items-center px-4">
            <div className="text-sm">
                <div>{t("keyboard-height")}</div>
            </div>
            <div className="flex items-center gap-2">
                <div className="text-sm">{keyboardHeight}%</div>
                <input
                    ref={sliderRef}
                    type="range"
                    min="1"
                    max="100"
                    step={1}
                    className="h-[180px]"
                    value={keyboardHeight}
                    onInput={(v) => {
                        setKeyboardHeight(
                            Number((v.target as HTMLInputElement).value),
                        );
                    }}
                />
                <button
                    type="button"
                    className="cursor-pointer"
                    onClick={() => {
                        setKeyboardHeight(50);
                        usePreferenceStore.setState((prev) => ({
                            ...prev,
                            keyboardHeight: undefined,
                        }));
                    }}
                >
                    <i className="icon-[mdi--reload]"></i>
                </button>
            </div>
        </div>
    );
}
