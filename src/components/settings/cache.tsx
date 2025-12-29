import { useEffect, useState } from "react";
import { useIntl } from "@/locale";
import { assetCache } from "@/utils/asset-cache";
import { Button } from "../ui/button";

export default function CacheSettingsItem() {
    const t = useIntl();
    const [clearing, setClearing] = useState(false);
    const [stats, setStats] = useState<{ count: number; size: number } | null>(null);

    const loadStats = async () => {
        try {
            const cacheStats = await assetCache.getStats();
            setStats(cacheStats);
        } catch (error) {
            console.error("Failed to load cache stats:", error);
        }
    };

    const clearCache = async () => {
        setClearing(true);
        try {
            await assetCache.clear();
            setStats(null);
            // Reload stats after clearing
            await loadStats();
            alert(t("cache-cleared"));
        } catch (error) {
            console.error("Failed to clear cache:", error);
            alert(t("cache-clear-failed"));
        } finally {
            setClearing(false);
        }
    };

    useEffect(() => {
        loadStats();
    }, []);

    const formatSize = (bytes: number) => {
        if (bytes === 0) return "0 B";
        const k = 1024;
        const sizes = ["B", "KB", "MB", "GB"];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
    };

    return (
        <div className="cache-settings">
            <Button
                onClick={clearCache}
                disabled={clearing}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--cached] size-5"></i>
                        <div>
                            <div>{t("clear-attachment-cache")}</div>
                            {stats && (
                                <div className="text-xs text-muted-foreground mt-1">
                                    {t("cache-stats", {
                                        count: stats.count.toString(),
                                        size: formatSize(stats.size),
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
        </div>
    );
}
