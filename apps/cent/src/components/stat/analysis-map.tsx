import { useEffect, useMemo, useRef, useState } from "react";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import MapCanvas from "../map";
import { isCoordinate } from "../map/protocol";
import { useMapProvider } from "../map/provider";
import { showMapConfig } from "../settings/map-settings";
import { Button } from "../ui/button";

export default function AnalysisMap({
    bills,
}: {
    bills?: Pick<Bill, "location" | "id" | "amount">[];
}) {
    const t = useIntl();
    const mapConfig = useLedgerStore((state) => state.infos?.meta.map);
    const provider = useMapProvider(mapConfig);
    const points = useMemo(
        () =>
            (bills ?? []).flatMap((bill) => {
                const { location } = bill;
                return location &&
                    isCoordinate(location.latitude, location.longitude)
                    ? [{ ...bill, location }]
                    : [];
            }),
        [bills],
    );
    const containerRef = useRef<HTMLDivElement>(null);
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsVisible(true);
                    observer.disconnect();
                }
            },
            { threshold: 0.1 },
        );
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const onSettings = () => {
        void showMapConfig().catch(() => {});
    };

    return (
        <div
            ref={containerRef}
            className="rounded-md border p-2 w-full flex flex-col relative"
        >
            <h2 className="font-medium text-lg my-3 text-center">
                {t("ledger-footprint")}
            </h2>
            {!provider?.mount ? (
                <div className="flex flex-col items-center gap-2 py-2 text-sm">
                    <p>{t("map-error-configure-in-settings")}</p>
                    <Button size="sm" variant="outline" onClick={onSettings}>
                        {t("map-settings")}
                    </Button>
                </div>
            ) : !points.length ? (
                <div className="text-center text-sm opacity-60 py-2">
                    {t("ledger-no-footprint-tip")}
                </div>
            ) : isVisible ? (
                <div
                    data-map-container
                    className="w-full h-[240px] md:h-[300px]"
                >
                    <MapCanvas
                        key={provider.identity}
                        provider={provider}
                        bills={points}
                        onSettings={onSettings}
                    />
                </div>
            ) : null}
        </div>
    );
}
