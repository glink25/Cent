import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import RateInput from "./rate-input";

export type ManualRateEdit = {
    baseCurrencyLabel: string;
    targetCurrencyLabel: string;
    initialRate: number;
};

function ManualRateForm({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: ManualRateEdit;
    onCancel?: () => void;
    onConfirm?: (v: number | null) => void;
}) {
    const t = useIntl();
    const [rate, setRate] = useState<number | undefined>(edit?.initialRate);

    useEffect(() => {
        setRate(edit?.initialRate);
    }, [edit?.initialRate]);

    if (!edit) {
        return null;
    }

    const handleConfirm = () => {
        if (rate === undefined) {
            onConfirm?.(null);
            return;
        }
        if (rate <= 0 || Number.isNaN(rate)) {
            toast.error(t("rate-must-positive"));
            return;
        }
        onConfirm?.(rate);
    };

    return (
        <div className="w-full flex flex-col p-4 gap-3">
            <div>
                <h1 className="text-lg font-semibold">
                    {t("manually-update-rate")}
                </h1>
                <p className="text-xs opacity-60">
                    {t("manually-update-rate-desc")}
                </p>
            </div>
            <RateInput
                baseCurrencyLabel={edit.baseCurrencyLabel}
                targetCurrencyLabel={edit.targetCurrencyLabel}
                value={rate}
                onChange={setRate}
            />
            <div className="flex gap-2 justify-end pt-1">
                <Button variant="ghost" size="sm" onClick={() => onCancel?.()}>
                    {t("cancel")}
                </Button>
                <Button size="sm" onClick={handleConfirm}>
                    {t("confirm")}
                </Button>
            </div>
        </div>
    );
}

export const [ManualRateProvider, showManualRateUpdate] = createConfirmProvider<
    ManualRateEdit,
    number | null
>(ManualRateForm, {
    dialogTitle: "Manually update rate",
    dialogModalClose: false,
    contentClassName: "w-[360px] h-fit max-w-[90vw]",
    fade: true,
});
