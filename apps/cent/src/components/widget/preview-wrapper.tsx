import { useEffect, useState } from "react";
import { useTheme } from "@/hooks/use-theme";
import type { Bill } from "@/ledger/type";
import { useLedgerStore } from "@/store/ledger";
import compileWidget from "./core/compile";
import runWidget from "./core/runner";
import WidgetPreviewSkeleton from "./skeleton";
import type { DSLNode } from "./type";
import WidgetRenderer from "./widget";

type WidgetPreviewWrapperProps = {
    code: string;
    settings?: Record<string, any>;
    grants?: string[];
    className?: string;
    bills?: Bill[];
};

export default function WidgetPreviewWrapper({
    code,
    settings = {},
    grants,
    className,
    bills: externalBills,
}: WidgetPreviewWrapperProps) {
    const [dsl, setDsl] = useState<DSLNode | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    const storeBills = useLedgerStore((s) => s.bills);
    const bills = externalBills ?? storeBills;
    const budgets = useLedgerStore((s) => s.infos?.meta.budgets);
    const creators = useLedgerStore((s) => s.infos?.creators);
    const categories = useLedgerStore((s) => s.infos?.meta.categories);
    const baseCurrency = useLedgerStore((s) => s.infos?.meta.baseCurrency);
    const customCurrencies = useLedgerStore(
        (s) => s.infos?.meta.customCurrencies,
    );
    const quickCurrencies = useLedgerStore(
        (s) => s.infos?.meta.quickCurrencies,
    );
    const tags = useLedgerStore((s) => s.infos?.meta.tags);
    const { theme } = useTheme();

    useEffect(() => {
        let mounted = true;

        const runPreview = async () => {
            setLoading(true);
            setError(null);

            try {
                const _compiled = compileWidget(code);

                const isDark =
                    theme === "dark" ||
                    (theme === "system" &&
                        window.matchMedia("(prefers-color-scheme: dark)")
                            .matches);

                const result = await runWidget(code, {
                    settings,
                    grants,
                    getData: async () => ({
                        bills,
                        budgets,
                        filter: {},
                        creators,
                        categories,
                        baseCurrency,
                        customCurrencies,
                        quickCurrencies,
                        tags,
                    }),
                    env: {
                        theme: isDark ? "dark" : "light",
                        language: "zh-CN",
                    },
                });

                if (!mounted) return;

                if (result.success && result.result) {
                    const dslNode =
                        (result.result as { _node?: DSLNode })?._node ??
                        result.result;
                    setDsl(dslNode as DSLNode);
                    setError(null);
                } else {
                    setError(result.error ?? "Unknown error");
                    setDsl(null);
                }
            } catch (err) {
                if (!mounted) return;
                setError(err instanceof Error ? err.message : String(err));
                setDsl(null);
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        runPreview();

        return () => {
            mounted = false;
        };
    }, [
        code,
        settings,
        grants,
        bills,
        budgets,
        creators,
        categories,
        baseCurrency,
        customCurrencies,
        quickCurrencies,
        tags,
        theme,
    ]);

    if (loading) return <WidgetPreviewSkeleton className={className} />;

    if (error) {
        return (
            <div className={`text-xs text-red-500 ${className ?? ""}`}>
                Error: {error.slice(0, 50)}
            </div>
        );
    }

    return <WidgetRenderer dsl={dsl} className={className} />;
}
