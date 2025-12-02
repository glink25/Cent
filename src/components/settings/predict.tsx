import { StorageDeferredAPI } from "@/api/storage";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { usePreference } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { startBackgroundPredict, stopBackgroundPredict } from "@/utils/predict";
import { Switch } from "../ui/switch";

export function PredictSettings() {
    const t = useIntl();
    const [smartPredict, setSmartPredict] = usePreference("smartPredict");
    const toggleSmartPredict = (v: boolean) => {
        setSmartPredict(v);
        if (v) {
            const book = useBookStore.getState().currentBookId;
            if (!book) {
                return;
            }
            const userId = useUserStore.getState().id;
            StorageDeferredAPI.learn(book, [userId]);
            startBackgroundPredict();
        } else {
            StorageDeferredAPI.clearModels();
            stopBackgroundPredict();
        }
    };
    return (
        <div className="w-full h-10 flex justify-between items-center px-4">
            <div className="text-sm">
                <div>{t("smart-predict")}</div>
                <div className="text-xs opacity-60">
                    {t("smart-predict-tip")}
                </div>
            </div>
            <Switch
                checked={smartPredict}
                onCheckedChange={toggleSmartPredict}
            />
        </div>
    );
}
