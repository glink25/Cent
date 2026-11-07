import { useLayoutEffect, useSyncExternalStore } from "react";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { getCSSVariable } from "@/utils/color";

export function useReverseIncomeExpenseColors() {
    const userId = useUserStore((state) => state.id);
    return useLedgerStore(
        (state) =>
            state.infos?.meta.personal?.[userId]?.reverseIncomeExpenseColors ??
            false,
    );
}

export function useApplyIncomeExpenseColors() {
    const reversed = useReverseIncomeExpenseColors();
    useLayoutEffect(() => {
        const root = document.documentElement;
        root.classList.toggle("reverse-income-expense-colors", reversed);
        return () => root.classList.remove("reverse-income-expense-colors");
    }, [reversed]);
}

function subscribeColors(onChange: () => void) {
    const observer = new MutationObserver(onChange);
    observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ["class"],
    });
    return () => observer.disconnect();
}

function getColorsSnapshot() {
    return `${getCSSVariable("--color-income")}|${getCSSVariable("--color-expense")}`;
}

/** Canvas charts must rebuild their options when the CSS palette changes. */
export function useIncomeExpenseChartColors() {
    return useSyncExternalStore(subscribeColors, getColorsSnapshot);
}
