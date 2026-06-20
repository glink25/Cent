import { useIntl, useLocale } from "@/locale";
import { locales } from "@/locale/utils";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

export default function LanguageSettingsItem() {
    const t = useIntl();
    const { locale, setLocale } = useLocale();
    return (
        <div className="w-full px-4 py-1 text-sm">
            <div className="w-full px-4 flex justify-between items-center text-sm font-medium">
                <div className="flex items-center gap-2">
                    <i className="icon-[mdi--language] size-5"></i>
                    {t("language")}
                </div>
                <Select
                    value={locale}
                    onValueChange={(v) => {
                        setLocale(v as any);
                        setTimeout(() => {
                            location.reload();
                        }, 10);
                    }}
                >
                    <SelectTrigger className="w-fit text-xs rounded-sm">
                        <SelectValue></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        {locales.map((l) => (
                            <SelectItem key={l.name} value={l.name}>
                                {l.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
