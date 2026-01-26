import { useCallback } from "react";
import { toast } from "sonner";
import { useShallow } from "zustand/shallow";
import { xmlTextToBills } from "@/components/assistant/text-to-bill";
import { goAddBill } from "@/components/bill-editor";
import { afterAddBillPromotion } from "@/components/promotion";
import { Button } from "@/components/ui/button";
import { numberToAmount } from "@/ledger/bill";
import { t, useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { asyncOnce } from "@/utils/async";
import { readClipboard } from "@/utils/clipboard";
import { decryptAES } from "@/utils/encrypt";
import useCategory from "./use-category";
import { usePageVisibility } from "./use-page-visibility";
import useRapidReducedMotionChange from "./use-reduce-motion";

export function useQuickGoAdd() {
    const enterAddBillWhenReduceMotionChanged = usePreferenceStore(
        useShallow((state) => state.enterAddBillWhenReduceMotionChanged),
    );
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

    const readClipboardWhenReduceMotionChanged = usePreferenceStore(
        useShallow((state) => state.readClipboardWhenReduceMotionChanged),
    );
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

// 将 checkRelayrData 移到组件外部，使用 asyncOnce 确保不会重复执行
const _checkRelayrData = async () => {
    const relayrConfig = usePreferenceStore.getState().relayr;
    const relayrUrl = import.meta.env.VITE_RELAYR_URL;

    console.log(relayrConfig, "relayrConfig");
    // 检查是否启用 relayr
    if (!relayrConfig?.enable) {
        return;
    }

    // 检查必要的配置
    if (!relayrUrl) {
        console.warn("Relayr URL is not configured");
        return;
    }

    const dataKey = relayrConfig?.passcode;
    if (!dataKey) {
        console.warn("Relayr passcode is not configured");
        return;
    }

    // 最多尝试两次
    let attemptCount = 0;
    const maxAttempts = 1;

    const fetchData = async (): Promise<string | null> => {
        try {
            const response = await fetch(`${relayrUrl}?key=${dataKey}`);

            if (!response.ok) {
                throw new Error(
                    `Relayr API error: ${response.status} ${response.statusText}`,
                );
            }

            // response 返回值：{content:string,iv:string,is_encrypted:boolean}
            // 当is_encrypted为true时，需要通过encryptKey进行解密
            const result = await response.json();

            // 检查返回的数据是否有值
            if (!result || result === null || result === "") {
                return null;
            }

            const content = result.content;
            if (result.is_encrypted === true) {
                const encryptKey = relayrConfig?.encryptKey;
                const iv = result.iv;
                if (!encryptKey) {
                    console.warn("数据已加密，但未配置加密密钥");
                    return null;
                }
                if (!iv) {
                    console.warn("数据已加密，但缺少 IV");
                    return null;
                }
                try {
                    const decrypted = await decryptAES(content, iv, encryptKey);
                    return decrypted;
                } catch (decryptError) {
                    console.error("解密 relayr 数据失败:", decryptError);
                    return null;
                }
            }
            return content;
        } catch (error) {
            console.warn("no relayr data:", error);
            return null;
        }
    };

    // 尝试获取数据，最多两次
    while (attemptCount < maxAttempts) {
        attemptCount++;
        const data = await fetchData();
        if (data) {
            // 如果有数据，通过 toast 展示
            const bills = await xmlTextToBills(data);
            if (bills.length === 0) {
                return;
            }
            await useLedgerStore.getState().addBills(bills);
            toast.success(t("voice-add-success", { count: bills.length }));
            return;
        }
        // 如果第一次失败，等待一小段时间后重试
        if (attemptCount < maxAttempts) {
            await new Promise((resolve) => setTimeout(resolve, 500));
        }
    }
};

// 使用 asyncOnce 包装，确保不会重复执行
const checkRelayrData = asyncOnce(_checkRelayrData);

export function useQuickEntryByRelayr() {
    const relayrConfig = usePreferenceStore(
        useShallow((state) => state.relayr),
    );

    // 监听页面可见性变化
    usePageVisibility(checkRelayrData, {
        disabled: !relayrConfig?.enable,
    });
}
