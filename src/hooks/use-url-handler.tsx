import { useEffect } from "react";
import { toast } from "sonner";
import {
    parseTextToBill,
    xmlTextToBills,
} from "@/components/assistant/text-to-bill";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";

/**
 * 处理标准 URL 链接唤起
 * 支持格式: https://myapp.com/add-bills?text=xxx
 */
export function useUrlHandler() {
    const t = useIntl();

    useEffect(() => {
        // 处理通过标准 URL 启动的情况
        const handleUrlLaunch = async () => {
            const url = new URL(window.location.href);
            const pathname = url.pathname;
            const searchParams = url.searchParams;

            // 处理 /add-bills 路径
            if (pathname === "/add-bills" || pathname === "/add-bills/") {
                const text = decodeURIComponent(searchParams.get("text") ?? "");
                window.history.replaceState({}, "", "/");
                if (text) {
                    try {
                        // 解析文本为账单
                        const bills = await xmlTextToBills(text);
                        if (bills.length > 0) {
                            await useLedgerStore.getState().addBills(bills);
                            toast.success(
                                t("voice-add-success", { count: bills.length }),
                            );
                        } else {
                            toast.error(
                                t("voice-recognition-failed", { error: "" }),
                            );
                        }
                    } catch (error) {
                        console.error("处理 URL 参数失败:", error);
                        toast.error(
                            t("voice-recognition-failed", {
                                error:
                                    error instanceof Error ? error.message : "",
                            }),
                        );
                    }
                }
                // 清理 URL，避免刷新时重复处理
            }
        };

        handleUrlLaunch();
    }, [t]);
}
