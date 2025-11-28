import { useState } from "react";
import { StorageDeferredAPI } from "@/api/storage";
import { useBookStore } from "@/store/book";
import { usePreference } from "@/store/preference";
import { startBackgroundPredict, stopBackgroundPredict } from "@/utils/predict";
import { Switch } from "../ui/switch";

export function PredictSettings() {
    const [smartPredict, setSmartPredict] = usePreference("smartPredict");
    const toggleSmartPredict = (v: boolean) => {
        setSmartPredict(v);
        if (v) {
            const book = useBookStore.getState().currentBookId;
            if (!book) {
                return;
            }
            StorageDeferredAPI.learn(book);
            startBackgroundPredict();
        } else {
            StorageDeferredAPI.clearModels();
            stopBackgroundPredict();
        }
    };
    return (
        <div className="w-full h-10 flex justify-between items-center px-4">
            <div className="text-sm">
                <div>智能预测</div>
                <div className="text-xs opacity-60">
                    记账时根据时间预测可能的类别和备注
                </div>
            </div>
            <Switch
                checked={smartPredict}
                onCheckedChange={toggleSmartPredict}
            />
        </div>
    );
}
