import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import CurrencyListForm from "./list";

export const [CurrencyListProvider, showCurrencyList] = createConfirmProvider(
    CurrencyListForm,
    {
        dialogTitle: "Currency",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);

export default function CurrencySettingsItem() {
    const t = useIntl();
    return (
        <div className="backup">
            <Button
                onClick={() => {
                    showCurrencyList();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--currency-eur] size-5"></i>
                        {t("currency-manager")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
        </div>
    );
}
