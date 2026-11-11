import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useWidget } from "@/hooks/use-widget";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { Button } from "../ui/button";
import ConfigForm from "./config-form";
import compileWidget, { Permission } from "./core/compile";
import InteractiveWidget from "./interactive";
import type { Widget, WidgetPermissions } from "./type";

const defaultCode = `/**
 * @widget-api 2.0
 * @name My Widget
 * @permissions billing
 */

export const config = {
  title: { type: 'text', label: '组件标题', default: '我的账单' },
  showCount: { type: 'select', label: '显示数量', options: ['是', '否'], default: '是' }
};

export default function Main({ data, settings }) {
    const bills = data.billing || [];
    const total = bills.reduce((sum, bill) => sum + bill.amount, 0);
    const title = settings.title || '我的账单';
    const showCount = settings.showCount === '是';
    
    return Flex(
        Text(title).fontSize(16).bold(),
        Text("Total: " + total).fontSize(14),
        showCount ? Text("Bills: " + bills.length).fontSize(12) : null
    ).direction('column').gap(8);
}
`;

export default function WidgetEdit({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: Widget;
    onConfirm?: (widget: Widget) => void;
    onCancel?: () => void;
}) {
    const t = useIntl();
    const [bookId] = useState(() => useBookStore.getState().currentBookId);
    const { add, update } = useWidget();
    const [code, setCode] = useState(edit?.code ?? defaultCode);
    const [formSettings, setFormSettings] = useState<Record<string, any>>(
        edit?.settings ?? {},
    );
    const [permissions, setPermissions] = useState<WidgetPermissions>({
        edit: false,
        storage: false,
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
            edit: edit?.permissions.includes("edit") ?? false,
            storage: edit?.permissions.includes("storage") ?? false,
            billing: edit ? edit.permissions.includes("billing") : true,
            filter: edit ? edit.permissions.includes("filter") : true,
            budget: edit ? edit.permissions.includes("budget") : true,
            collaborators: edit
                ? edit.permissions.includes("collaborators")
                : true,
            category: edit ? edit.permissions.includes("category") : true,
            currency: edit ? edit.permissions.includes("currency") : true,
            tag: edit ? edit.permissions.includes("tag") : true,
        });

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
                edit: compiled.permissions.includes(Permission.Edit),
                storage: compiled.permissions.includes(Permission.Storage),
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

        if (!compiled.apiVersion.startsWith("2.")) {
            toast.error(t("widget-upgrade-required"));
            return;
        }

        const widgetData = {
            name: compiled.name || "Untitled Widget",
            code,
            permissions: compiled.permissions.filter(
                (p) => allowedPermissions[p],
            ),
            settings: formSettings,
        };

        if (useBookStore.getState().currentBookId !== bookId) {
            toast.error("Ledger changed. Reopen the widget editor.");
            return;
        }
        let saved: Widget;
        if (edit?.id) {
            await update(edit.id, widgetData);
            saved = { ...edit, ...widgetData, updatedAt: Date.now() };
        } else {
            saved = await add(widgetData);
        }
        if (onConfirm) onConfirm(saved);
        else onCancel?.();
    };

    return (
        <PopupLayout
            onBack={onCancel}
            title={edit?.id ? t("edit-widget") : t("add-widget")}
            className="h-full overflow-hidden"
        >
            <div className="flex flex-col h-full overflow-hidden">
                <div className="flex-1 flex flex-col overflow-y-auto">
                    <div className="flex flex-col">
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
                                                            [key]: e.target
                                                                .checked,
                                                        }),
                                                    )
                                                }
                                                className="size-3"
                                            />
                                            {key === "edit"
                                                ? "写入账单（仅可修改自身创建的数据）"
                                                : key === "storage"
                                                  ? "读写组件共享存储"
                                                  : t(`permission-${key}`)}
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

                        <div className="flex-1 flex flex-col overflow-hidden flex-shrink-0">
                            <div className="flex flex-col overflow-hidden">
                                <div className="px-4 py-2 text-xs font-medium border-b bg-muted/50">
                                    {t("widget-preview")}
                                </div>
                                <div className="p-4 flex justify-center items-start">
                                    {compiled?.apiVersion.startsWith("2.") ? (
                                        <InteractiveWidget
                                            key={`${code}:${JSON.stringify(allowedPermissions)}`}
                                            preview
                                            widget={{
                                                id: edit?.id ?? "preview",
                                                name: compiled.name,
                                                code,
                                                permissions:
                                                    compiled.permissions.filter(
                                                        (p) =>
                                                            allowedPermissions[
                                                                p
                                                            ],
                                                    ),
                                                settings: formSettings,
                                                storage: edit?.storage,
                                                createdAt: 0,
                                                updatedAt: 0,
                                            }}
                                            className="w-full"
                                        />
                                    ) : (
                                        <div className="text-xs">
                                            {t(
                                                compiled
                                                    ? "widget-upgrade-required"
                                                    : "widget-invalid-code",
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex-1 flex flex-col overflow-hidden border-t min-h-[400px]">
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
