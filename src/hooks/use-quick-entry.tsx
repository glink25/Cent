import { useCallback } from "react";
import { toast } from "sonner";
import { goAddBill } from "@/components/bill-editor";
import { afterAddBillPromotion } from "@/components/promotion";
import { Button } from "@/components/ui/button";
import { numberToAmount } from "@/ledger/bill";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { readClipboard } from "@/utils/clipboard";
import useCategory from "./use-category";
import { usePageVisibility } from "./use-page-visibility";
import useRapidReducedMotionChange from "./use-reduce-motion";

export function useQuickGoAdd() {
    const { enterAddBillWhenReduceMotionChanged } = usePreferenceStore();
    useRapidReducedMotionChange(
        useCallback(() => {
            goAddBill();
            afterAddBillPromotion();
        }, []),
        {
            disabled: !enterAddBillWhenReduceMotionChanged,
        },
    );
}

export function useQuickEntryByClipboard() {
    const t = useIntl();

    const { readClipboardWhenReduceMotionChanged } = usePreferenceStore();
    const { categories, expenses } = useCategory();
    useRapidReducedMotionChange(
        useCallback(async () => {
            let toastId: string | number | null = null;
            const handleData = async (text: string | null) => {
                if (toastId !== null) {
                    toast.dismiss(toastId);
                }
                if (!text) {
                    return;
                }
                const data = JSON.parse(text) as {
                    money: number;
                    category: string;
                    comment: string;
                };
                const category =
                    categories.find((c) => c.id === data.category) ??
                    expenses[0];
                await useLedgerStore.getState().addBill({
                    categoryId: category.id,
                    amount: numberToAmount(data.money),
                    comment: data.comment,
                    type: "expense",
                    time: Date.now(),
                });
                toast.success(t("quick-entry-success"), { duration: 2000 });
            };
            const { text } = await readClipboard();
            if (text === null) {
                toastId = toast(t("read-bill-from-clipboard"), {
                    className: "[&>[data-content]]:flex-1",
                    duration: 5000,
                    position: "top-center",
                    action: (
                        <Button
                            onClick={async () => {
                                const { text } = await readClipboard();
                                handleData(text);
                            }}
                        >
                            {t("read-clipboard")}
                        </Button>
                    ),
                });
                return;
            }
            handleData(text);
        }, [categories, t, expenses[0]]),
        {
            disabled: !readClipboardWhenReduceMotionChanged,
        },
    );
}

/** @deprecated */
export function useQuickEntryByReLayr() {
    const t = useIntl();

    const { quickEntryWithReLayr, reLayrPort, reLayrKey } =
        usePreferenceStore();
    const { categories, expenses } = useCategory();
    usePageVisibility(
        useCallback(async () => {
            const handleData = async (text: string | null) => {
                if (!text) {
                    return;
                }
                const data = JSON.parse(text) as {
                    money: number;
                    category: string;
                    comment: string;
                };
                const category =
                    categories.find((c) => c.id === data.category) ??
                    expenses[0];
                await useLedgerStore.getState().addBill({
                    categoryId: category.id,
                    amount: numberToAmount(data.money),
                    comment: data.comment,
                    type: "expense",
                    time: Date.now(),
                });
                toast.success(t("quick-entry-success"), { duration: 2000 });
            };
            const res = await fetch(
                `http://localhost:${reLayrPort}?key=${reLayrKey}`,
            );
            if (!res.ok) {
                return;
            }
            const text = await res.text();
            handleData(text);
        }, [categories, t, expenses[0], reLayrKey, reLayrPort]),
        {
            disabled: !quickEntryWithReLayr,
        },
    );
}
