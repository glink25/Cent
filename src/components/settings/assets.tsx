import { useCallback, useEffect, useState } from "react";
import { loadStorageAPI } from "@/api/storage/dynamic";
import { useIntl } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { usePreference } from "@/store/preference";
import { clearCached, getCachedInfo } from "@/utils/cache";
import { GetOnlineAssetsCacheKey } from "@/utils/constant";
import { toFileSize } from "@/utils/number";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

export function AssetsSettings() {
    const t = useIntl();
    const [showAssetsInLedger, setShowAssetsInLedger] =
        usePreference("showAssetsInLedger");

    const refreshCacheSize = useCallback(async () => {
        // 1. 获取tidal内部的文件缓存
        const getTidalAssetsSize = async () => {
            const allBills = await useLedgerStore.getState().refreshBillList();
            const size = allBills.reduce(
                (prev, bill) =>
                    prev +
                    (bill.images?.reduce(
                        (p, c) => p + (typeof c === "string" ? 0 : c.size),
                        0,
                    ) ?? 0),
                0,
            );
            return size;
        };
        // 2. 获取cache函数的indexedDB缓存
        const getCacheSize = async () => {
            const info = await getCachedInfo(GetOnlineAssetsCacheKey);
            return info.total;
        };

        const res = await Promise.all([getTidalAssetsSize(), getCacheSize()]);
        const size = res.reduce((p, c) => p + c, 0);
        setCachedSize(size);
    }, []);

    const [cachedSize, setCachedSize] = useState<number | undefined>(undefined);
    useEffect(() => {
        setTimeout(() => {
            refreshCacheSize();
        }, 2000);
    }, [refreshCacheSize]);

    const [clearing, setClearing] = useState(false);
    const clearCache = async () => {
        // 仅在同步完成后才可以清理
        if (useLedgerStore.getState().sync !== "success") {
            return;
        }
        setClearing(true);
        // 1. 清理tidal本地的哈希缓存，触发再次同步
        const clearTidalHash = async () => {
            const book = useBookStore.getState().currentBookId;
            if (!book) {
                return;
            }
            const { StorageAPI } = await loadStorageAPI();
            StorageAPI.forceNeedSync?.(book);
        };
        // 2. 清理cache函数的indexedDB缓存
        const clearCacheInDB = () => {
            return clearCached(GetOnlineAssetsCacheKey);
        };
        try {
            await Promise.all([clearTidalHash(), clearCacheInDB()]);
            await refreshCacheSize();
        } finally {
            setClearing(false);
        }
    };
    return (
        <>
            <div className="text-xs opacity-60 px-4 py-1 pt-4">
                {t("assets-settings")}
            </div>
            <div className="flex-shrink-0 divide-y divide-solid flex flex-col overflow-hidden gap-2">
                <div className="w-full h-10 flex justify-between items-center px-4">
                    <div className="text-sm">
                        <div>{t("show-assets-in-ledger")}</div>
                    </div>
                    <Switch
                        checked={showAssetsInLedger ?? false}
                        onCheckedChange={setShowAssetsInLedger}
                    />
                </div>
                <div className="w-full h-10 flex justify-between items-center px-4">
                    <div className="text-sm">
                        <div>{t("clear-assets-cache")}</div>
                        <div className="text-xs opacity-60">
                            {cachedSize === undefined
                                ? t("calculating")
                                : toFileSize(cachedSize)}
                        </div>
                    </div>
                    <Button
                        disabled={clearing || cachedSize === undefined}
                        size={"sm"}
                        variant={"outline"}
                        onClick={clearCache}
                    >
                        {t("clear-cache")}
                    </Button>
                </div>
            </div>
        </>
    );
}
