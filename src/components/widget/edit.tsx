import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";
import { useWidget } from "@/hooks/use-widget";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { Button } from "../ui/button";
import ConfigForm from "./config-form";
import compileWidget, { Permission } from "./core/compile";
import runWidget from "./core/runner";
import { WidgetPreviewSkeleton } from "./preview-wrapper";
import type { DSLNode, Widget, WidgetPermissions } from "./type";
import WidgetRenderer from "./widget";

const defaultCode = `/**
 * @widget-api 1.0
 * @name My Widget
 * @permissions billing
 */

export const config = {
  title: { type: 'text', label: '组件标题', default: '我的账单' },
  showCount: { type: 'select', label: '显示数量', options: ['是', '否'], default: '是' }
};

export default async ({ data, settings }) => {
    const bills = data.billing || [];
    const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const title = settings.title || '我的账单';
    const showCount = settings.showCount === '是';
    
    return Flex(
        Text(title).fontSize(16).bold(),
        Text("Total: " + total).fontSize(14),
        showCount ? Text("Bills: " + bills.length).fontSize(12) : null
    ).direction('column').gap(8);
};
`;

export default function WidgetEdit({
    edit,
    onCancel,
}: {
    edit?: Widget;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const { add, update } = useWidget();
    const [code, setCode] = useState(edit?.code ?? defaultCode);
    const [formSettings, setFormSettings] = useState<Record<string, any>>(
        edit?.settings ?? {},
    );
    const [previewDsl, setPreviewDsl] = useState<DSLNode | null>(null);
    const [previewError, setPreviewError] = useState<string | null>(null);
    const [previewLoading, setPreviewLoading] = useState(true);
    const [permissions, setPermissions] = useState<WidgetPermissions>({
        billing: false,
        filter: false,
        budget: false,
        collaborators: false,
        category: false,
        currency: false,
        tag: false,
    });
    const [allowedPermissions, setAllowedPermissions] =
        useState<WidgetPermissions>({
            billing: true,
            filter: true,
            budget: true,
            collaborators: true,
            category: true,
            currency: true,
            tag: true,
        });

    const bills = useLedgerStore((s) => s.bills);
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

    const compiled = useMemo(() => {
        try {
            return compileWidget(code);
        } catch {
            return null;
        }
    }, [code]);

    useEffect(() => {
        if (compiled) {
            const newPermissions: WidgetPermissions = {
                billing: compiled.permissions.includes(Permission.Billing),
                filter: compiled.permissions.includes(Permission.Filter),
                budget: compiled.permissions.includes(Permission.Budget),
                collaborators: compiled.permissions.includes(
                    Permission.Collaborators,
                ),
                category: compiled.permissions.includes(Permission.Category),
                currency: compiled.permissions.includes(Permission.Currency),
                tag: compiled.permissions.includes(Permission.Tag),
            };
            setPermissions(newPermissions);
        }
    }, [compiled]);

    const getData = useCallback(async () => {
        return {
            bills,
            budgets,
            filter: {},
            creators,
            categories,
            baseCurrency,
            customCurrencies,
            quickCurrencies,
            tags,
        };
    }, [
        bills,
        budgets,
        creators,
        categories,
        baseCurrency,
        customCurrencies,
        quickCurrencies,
        tags,
    ]);

    const runPreview = useCallback(async () => {
        if (!compiled) {
            setPreviewError("Invalid widget code");
            setPreviewDsl(null);
            setPreviewLoading(false);
            return;
        }

        const activePermissions = Object.entries(allowedPermissions)
            .filter(([, allowed]) => allowed)
            .map(([perm]) => perm);

        const hasDisallowed = compiled.permissions.some(
            (p) => !activePermissions.includes(p),
        );

        if (hasDisallowed) {
            setPreviewError("Some permissions are not allowed");
            setPreviewDsl(null);
            setPreviewLoading(false);
            return;
        }

        setPreviewLoading(true);

        try {
            const isDark =
                theme === "dark" ||
                (theme === "system" &&
                    window.matchMedia("(prefers-color-scheme: dark)").matches);

            const result = await runWidget(code, {
                settings: formSettings,
                getData,
                env: {
                    theme: isDark ? "dark" : "light",
                    language: "zh-CN",
                },
            });

            if (result.success && result.result) {
                const dslNode =
                    (result.result as { _node?: DSLNode })?._node ??
                    result.result;
                setPreviewDsl(dslNode as DSLNode);
                setPreviewError(null);
            } else {
                setPreviewError(result.error ?? "Unknown error");
                setPreviewDsl(null);
            }
        } catch (err) {
            setPreviewError(err instanceof Error ? err.message : String(err));
            setPreviewDsl(null);
        } finally {
            setPreviewLoading(false);
        }
    }, [code, compiled, allowedPermissions, formSettings, getData, theme]);

    useEffect(() => {
        const timer = setTimeout(runPreview, 500);
        return () => clearTimeout(timer);
    }, [runPreview]);

    const handleFormChange = useCallback((key: string, value: any) => {
        setFormSettings((prev) => ({
            ...prev,
            [key]: value,
        }));
    }, []);

    const handleSave = async () => {
        if (!compiled) {
            toast.error(t("widget-invalid-code"));
            return;
        }

        const widgetData = {
            name: compiled.name || "Untitled Widget",
            code,
            permissions: compiled.permissions,
            settings: formSettings,
        };

        if (edit) {
            await update(edit.id, widgetData);
        } else {
            await add(widgetData);
        }

        onCancel?.();
    };

    return (
        <PopupLayout
            onBack={onCancel}
            title={edit ? t("edit-widget") : t("add-widget")}
            className="h-full overflow-hidden"
        >
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 flex flex-col overflow-hidden">
                    <div className="px-4 py-2 flex items-center gap-2 border-b">
                        <div className="text-sm font-medium">
                            {t("widget-permissions")}
                        </div>
                        {Object.entries(permissions).map(
                            ([key, required]) =>
                                required && (
                                    <label
                                        key={key}
                                        className="flex items-center gap-1 text-xs"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={
                                                allowedPermissions[
                                                    key as keyof WidgetPermissions
                                                ]
                                            }
                                            onChange={(e) =>
                                                setAllowedPermissions(
                                                    (prev) => ({
                                                        ...prev,
                                                        [key]: e.target.checked,
                                                    }),
                                                )
                                            }
                                            className="size-3"
                                        />
                                        {t(`permission-${key}`)}
                                    </label>
                                ),
                        )}
                    </div>

                    {compiled?.config && (
                        <ConfigForm
                            config={compiled.config}
                            settings={formSettings}
                            onChange={handleFormChange}
                        />
                    )}

                    <div className="flex-1 flex flex-col overflow-hidden">
                        <div className="flex flex-col overflow-hidden">
                            <div className="px-4 py-2 text-xs font-medium border-b bg-muted/50">
                                {t("widget-preview")}
                            </div>
                            <div className="p-4 flex justify-center items-start">
                                {previewLoading ? (
                                    <div className="max-w-[320px] w-full h-[120px] bg-card rounded-lg shadow-lg">
                                        <WidgetPreviewSkeleton />
                                    </div>
                                ) : previewError ? (
                                    <div className="text-red-500 text-xs whitespace-pre-wrap select-text">
                                        {previewError}
                                    </div>
                                ) : (
                                    <div className="max-w-[320px] w-full h-[120px] bg-card rounded-lg shadow-lg p-4">
                                        <WidgetRenderer dsl={previewDsl} />
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="flex-1 flex flex-col overflow-hidden border-t">
                            <div className="px-4 py-2 text-xs font-medium border-b bg-muted/50">
                                {t("widget-code")}
                            </div>
                            <textarea
                                value={code}
                                onChange={(e) => setCode(e.target.value)}
                                className="flex-1 w-full p-4 font-mono text-xs resize-none border-none outline-none bg-background"
                                spellCheck={false}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-2 p-4 border-t">
                    <Button variant="outline" onClick={onCancel}>
                        {t("cancel")}
                    </Button>
                    <Button onClick={handleSave}>{t("save")}</Button>
                </div>
            </div>
        </PopupLayout>
    );
}
