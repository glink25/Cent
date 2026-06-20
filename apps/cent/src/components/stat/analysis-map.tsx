import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { decodeApiKey } from "@/utils/api-key";
import { Skeleton } from "../ui/skeleton";

// 使用 React.lazy 懒加载地图组件
const AMapContainer = lazy(() => import("@/components/map/index"));

export default function AnalysisMap({
    bills,
}: {
    bills?: Pick<Bill, "location" | "id" | "amount">[];
}) {
    const t = useIntl();
    const mapConfig = useLedgerStore((state) => state.infos?.meta.map);

    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 },
        );
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    const amapKey = useMemo(
        () =>
            mapConfig?.amapKey ? decodeApiKey(mapConfig.amapKey) : undefined,
        [mapConfig?.amapKey],
    );
    const amapSecurityCode = useMemo(
        () =>
            mapConfig?.amapSecurityCode
                ? decodeApiKey(mapConfig.amapSecurityCode)
                : undefined,
        [mapConfig?.amapSecurityCode],
    );

    if (!amapKey || !amapSecurityCode) {
        return null;
    }

    // 检查是否有账单包含地理位置信息
    const hasLocationData = bills?.some((bill) => bill.location);

    return (
        <div
            ref={containerRef}
            className="rounded-md border p-2 w-full flex flex-col relative"
        >
            <h2 className="font-medium text-lg my-3 text-center">
                {t("ledger-footprint")}
            </h2>
            {!hasLocationData ? (
                <div className="text-center text-sm opacity-60 py-2">
                    {t("ledger-no-footprint-tip")}
                </div>
            ) : isVisible ? (
                <div
                    data-map-container
                    className="w-full h-[240px] md:h-[300px]"
                >
                    <Suspense fallback={<Skeleton className="w-full h-full" />}>
                        <AMapContainer
                            bills={bills}
                            amapKey={amapKey}
                            amapSecurityCode={amapSecurityCode}
                        />
                    </Suspense>
                </div>
            ) : null}
        </div>
    );
}
