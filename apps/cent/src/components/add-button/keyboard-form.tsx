/** biome-ignore-all lint/a11y/noAutofocus: <explanation> */
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { parseTextToBill } from "../assistant/text-to-bill";
import { Button } from "../ui/button";

export default function KeyboardForm({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: string;
    onCancel?: () => void;
    onConfirm?: (v: string) => void;
}) {
    const t = useIntl();
    const [textValue, setTextValue] = useState("");
    const [loading, setLoading] = useState(false);

    const toConfirm = async () => {
        const text = textValue.trim();
        try {
            if (text.length === 0) {
                return;
            }
            setLoading(true);
            const bills = await parseTextToBill(textValue);
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
            setLoading(false);
            onConfirm?.(text);
        }
    };

    const textareaRef = useRef<HTMLTextAreaElement>(null);
    useEffect(() => {
        textareaRef.current?.focus();
    }, []);
    return (
        <div>
            <div className="min-h-[200px] flex flex-col w-full h-full bg-background text-foreground items-center justify-center relative">
                <div className="w-full flex justify-center items-center p-2 relative">
                    <div>{t("keyboard-input-title")}</div>
                    <Button
                        variant={"ghost"}
                        size={"sm"}
                        onClick={onCancel}
                        className="absolute right-2"
                    >
                        <i className="icon-[mdi--close] size-5"></i>
                    </Button>
                </div>
                <div className="w-full flex-1 flex flex-col px-4 py-2">
                    <textarea
                        ref={textareaRef}
                        autoFocus
                        className="w-full flex-1 resize-none p-2 rounded-md border outline-none focus:outline-foreground/50"
                        value={textValue}
                        placeholder={t("keyboard-input-placeholder")}
                        onChange={(e) => {
                            setTextValue(e.target.value);
                        }}
                    ></textarea>
                </div>
                <div className="w-full flex justify-end items-center p-2">
                    <Button
                        disabled={loading}
                        variant={"ghost"}
                        onClick={toConfirm}
                    >
                        {loading ? (
                            <>
                                <i className="icon-[mdi--loading] animate-spin"></i>
                                {t("keyboard-parsing")}
                            </>
                        ) : (
                            t("confirm")
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
}
