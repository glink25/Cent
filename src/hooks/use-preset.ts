import { useEffect, useRef } from "react";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import {
    applyCustomCSS,
    CUSTOM_CSS_STORAGE_KEY,
    purifyCSS,
} from "@/utils/preset";

/**
 * 监听 useLedgerStore 中的 personalMeta 中的 customCSS 变化
 * 考虑到性能，所以只监听一次，如果 customCSS 有值则进行初始化，随后不再监听
 * 如果变化，将变化后的 css 值持久化到 localStorage 中，并进行简易的 css 文本 purify 处理
 */
export function useInitPreset() {
    useEffect(() => {
        const unsubscribe = useLedgerStore.subscribe((state, prevState) => {
            const userId = useUserStore.getState().id;
            const currentCSS = state.infos?.meta.personal?.[userId]?.customCSS;
            const prevCSS = prevState.infos?.meta.personal?.[userId]?.customCSS;
            if (currentCSS !== prevCSS) {
                const purified = purifyCSS(currentCSS ?? "");
                try {
                    localStorage.setItem(CUSTOM_CSS_STORAGE_KEY, purified);
                    applyCustomCSS();
                } catch (error) {
                    console.error(
                        "Failed to save custom CSS to localStorage:",
                        error,
                    );
                }
            }
        });

        return () => {
            unsubscribe();
        };
    }, []);
}
