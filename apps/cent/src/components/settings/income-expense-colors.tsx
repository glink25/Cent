import { useId, useRef, useState } from "react";
import { toast } from "sonner";
import { useReverseIncomeExpenseColors } from "@/hooks/use-income-expense-colors";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { Switch } from "../ui/switch";

export default function IncomeExpenseColorsSettingsItem() {
    const t = useIntl();
    const id = useId();
    const reversed = useReverseIncomeExpenseColors();
    const [saving, setSaving] = useState(false);
    const savingRef = useRef(false);

    const toggle = async (checked: boolean) => {
        if (savingRef.current) return;
        savingRef.current = true;
        setSaving(true);
        try {
            await useLedgerStore.getState().updatePersonalMeta({
                reverseIncomeExpenseColors: checked,
            });
        } catch {
            toast.error(t("reverse-income-expense-colors-save-failed"));
        } finally {
            savingRef.current = false;
            setSaving(false);
        }
    };

    return (
        <div className="w-full min-h-10 pb-2 flex justify-between items-center gap-2 px-4 text-sm">
            <label htmlFor={id} className="flex-1">
                {t("reverse-income-expense-colors")}
            </label>
            <Switch
                id={id}
                checked={reversed}
                disabled={saving}
                onCheckedChange={toggle}
            />
        </div>
    );
}
