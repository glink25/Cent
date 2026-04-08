import { useIntl } from "@/locale";
import type { FormItem, WidgetSettingsForm } from "./core/compile";

type ConfigFormProps = {
    config: WidgetSettingsForm;
    settings: Record<string, any>;
    onChange: (key: string, value: any) => void;
};

export default function ConfigForm({
    config,
    settings,
    onChange,
}: ConfigFormProps) {
    const t = useIntl();

    if (Object.keys(config).length === 0) {
        return null;
    }

    const renderField = (key: string, item: FormItem) => {
        const value = settings[key] ?? item.default ?? "";

        switch (item.type) {
            case "text":
                return (
                    <input
                        id={`config-${key}`}
                        type="text"
                        value={value}
                        onChange={(e) => onChange(key, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border rounded bg-background"
                        placeholder={item.label}
                    />
                );

            case "number":
                return (
                    <input
                        id={`config-${key}`}
                        type="number"
                        value={value}
                        onChange={(e) =>
                            onChange(key, parseFloat(e.target.value) || 0)
                        }
                        className="flex-1 px-3 py-1.5 text-xs border rounded bg-background"
                        placeholder={item.label}
                    />
                );

            case "date":
                return (
                    <input
                        id={`config-${key}`}
                        type="date"
                        value={value}
                        onChange={(e) => onChange(key, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border rounded bg-background"
                    />
                );

            case "select":
                return (
                    <select
                        id={`config-${key}`}
                        value={value}
                        onChange={(e) => onChange(key, e.target.value)}
                        className="flex-1 px-3 py-1.5 text-xs border rounded bg-background"
                    >
                        <option value="">{t("select-placeholder")}</option>
                        {item.options?.map((option) => (
                            <option key={option} value={option}>
                                {option}
                            </option>
                        ))}
                    </select>
                );

            default:
                return null;
        }
    };

    return (
        <div className="px-4 py-2 border-b space-y-2">
            <div className="text-xs font-medium text-muted-foreground mb-2">
                {t("widget-config")}
            </div>
            {Object.entries(config).map(([key, item]) => (
                <div key={key} className="flex items-center gap-2">
                    <label
                        htmlFor={`config-${key}`}
                        className="text-xs min-w-[80px]"
                    >
                        {item.label}
                    </label>
                    {renderField(key, item)}
                </div>
            ))}
        </div>
    );
}
