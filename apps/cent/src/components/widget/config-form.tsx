import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
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
                    <Input
                        id={`config-${key}`}
                        type="text"
                        value={value}
                        onChange={(e) => onChange(key, e.target.value)}
                        className="flex-1 h-8 text-xs"
                        placeholder={item.label}
                    />
                );

            case "number":
                return (
                    <Input
                        id={`config-${key}`}
                        type="number"
                        value={value}
                        onChange={(e) =>
                            onChange(key, parseFloat(e.target.value) || 0)
                        }
                        className="flex-1 h-8 text-xs"
                        placeholder={item.label}
                    />
                );

            case "date":
                return (
                    <Input
                        id={`config-${key}`}
                        type="date"
                        value={value}
                        onChange={(e) => onChange(key, e.target.value)}
                        className="flex-1 h-8 text-xs"
                    />
                );

            case "select":
                return (
                    <Select
                        value={value}
                        onValueChange={(v) => onChange(key, v)}
                    >
                        <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue
                                placeholder={t("select-placeholder")}
                            />
                        </SelectTrigger>
                        <SelectContent>
                            {item.options?.map((option) => (
                                <SelectItem key={option} value={option}>
                                    {option}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
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
                    <Label
                        htmlFor={`config-${key}`}
                        className="text-xs min-w-[80px]"
                    >
                        {item.label}
                    </Label>
                    {renderField(key, item)}
                </div>
            ))}
        </div>
    );
}
