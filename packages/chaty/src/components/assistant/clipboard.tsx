import { createContext, useCallback, useContext } from "react";
import { toast } from "sonner";
import { useI18n } from "./i18n";
import type { RuntimeConfig } from "./runtime";

export const ClipboardContext =
    createContext<RuntimeConfig["copyText"]>(undefined);

export function useCopyText() {
    const copyText = useContext(ClipboardContext);
    const { t } = useI18n();
    return useCallback(
        async (text: string) => {
            try {
                if (copyText) await copyText(text);
                else await navigator.clipboard.writeText(text);
                toast.success(t("flowCopied"));
            } catch {
                toast.error(t("flowCopyFailed"));
            }
        },
        [copyText, t],
    );
}
