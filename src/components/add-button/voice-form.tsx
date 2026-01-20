import { createContext, useContext } from "react";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";

export type VoiceFormState = {
    text: string;
    phase: "listening" | "parsing";
};

export const VoiceFormContext = createContext<VoiceFormState | null>(null);

export default function VoiceForm({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const context = useContext(VoiceFormContext);
    if (!context) {
        console.warn("VoiceForm need be child of VoiceFormContext");
    }
    const text = context?.text;
    const phase = context?.phase ?? "listening";
    return (
        <div>
            <div className="min-h-[320px] flex flex-col w-full h-full bg-background text-foreground items-center justify-center relative">
                <div className="w-full flex justify-end items-center">
                    <Button variant={"ghost"} onClick={onCancel}>
                        <i className="icon-[mdi--close]"></i>
                    </Button>
                </div>
                {/* 麦克风图标和动画 */}
                <div className="relative flex items-center justify-center mt-14 mb-8">
                    {/* 外层扩散动画 */}
                    <div
                        className="absolute w-32 h-32 rounded-full bg-primary/20 animate-ping"
                        style={{ animationDuration: "2s" }}
                    />
                    {/* 内层扩散动画 */}
                    <div
                        className="absolute w-24 h-24 rounded-full bg-primary/30 animate-ping"
                        style={{ animationDuration: "1.5s" }}
                    />
                    {/* 麦克风图标背景 */}
                    <div className="relative w-20 h-20 rounded-full bg-primary flex items-center justify-center shadow-lg">
                        <i className="icon-[mdi--microphone] text-white size-10" />
                    </div>
                </div>

                {/* 识别文本占位 */}
                <div className="text-center mb-auto px-4 max-w-md">
                    {phase === "listening" ? (
                        <p
                            data-voice-text
                            className="text-lg text-foreground/80"
                        >
                            {text === undefined
                                ? t("voice-listening-text")
                                : text}
                        </p>
                    ) : (
                        <p
                            data-voice-text
                            className="text-lg text-foreground/80"
                        >
                            {t("voice-parsing-text")}
                        </p>
                    )}
                </div>

                {/* 底部提示 */}
                {phase === "listening" && (
                    <div className="text-center text-sm text-foreground/60 mt-4 p-4">
                        {t("voice-cancel-tip")}
                    </div>
                )}
            </div>
        </div>
    );
}
