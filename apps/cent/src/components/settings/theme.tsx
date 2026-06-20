import { type Theme, useTheme } from "@/hooks/use-theme";
import { useIntl } from "@/locale";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "../ui/select";

export default function ThemeSettingsItem() {
    const t = useIntl();
    const { theme, setTheme } = useTheme();
    return (
        <div className="w-full px-4 py-1 text-sm">
            <div className="w-full px-4 flex justify-between items-center text-sm font-medium">
                <div className="flex items-center gap-2">
                    <i className="icon-[mdi--clothes-hanger] size-5"></i>
                    {t("theme")}
                </div>
                <Select
                    value={theme}
                    onValueChange={(v) => {
                        setTheme(v as Theme);
                    }}
                >
                    <SelectTrigger className="w-fit text-xs rounded-sm">
                        <SelectValue></SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="system">
                            {t("theme-system")}
                        </SelectItem>
                        <SelectItem value="light">
                            {t("theme-light")}
                        </SelectItem>
                        <SelectItem value="dark">{t("theme-dark")}</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </div>
    );
}
