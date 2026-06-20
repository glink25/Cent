import AMapLoader from "@amap/amap-jsapi-loader";
import { useCallback, useEffect, useRef, useState } from "react";
import PopupLayout from "@/layouts/popup-layout";
import type { GeoLocation } from "@/ledger/type";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import Loading from "../loading";
import { Button } from "../ui/button";
import "./amap-types";

type LocationPickerValue = {
    location: GeoLocation;
    amapKey: string;
    amapSecurityCode: string;
};

const MAP_RENDER_DELAY = 410;

const toLocation = (center: AMap.LngLat): GeoLocation => ({
    latitude: center.lat,
    longitude: center.lng,
    accuracy: 0,
});

function LocationPickerForm({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: LocationPickerValue;
    onCancel?: () => void;
    onConfirm?: (v: GeoLocation) => void;
}) {
    const t = useIntl();
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<AMap.Map | null>(null);
    const [selectedLocation, setSelectedLocation] = useState<GeoLocation>(
        () =>
            edit?.location ?? {
                latitude: 39.90923,
                longitude: 116.397428,
                accuracy: 0,
            },
    );
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [shouldRenderMap, setShouldRenderMap] = useState(false);

    const syncCenter = useCallback(() => {
        const map = mapInstanceRef.current;
        if (!map) return;
        setSelectedLocation(toLocation(map.getCenter()));
    }, []);

    useEffect(() => {
        const timer = window.setTimeout(() => {
            setShouldRenderMap(true);
        }, MAP_RENDER_DELAY);

        return () => window.clearTimeout(timer);
    }, []);

    useEffect(() => {
        if (!shouldRenderMap) return;

        if (!mapRef.current || !edit?.amapKey || !edit.amapSecurityCode) {
            setLoading(false);
            setError(t("map-error-no-api-key"));
            return;
        }

        window._AMapSecurityConfig = {
            securityJsCode: edit.amapSecurityCode,
        };

        let cancelled = false;

        AMapLoader.load({
            key: edit.amapKey,
            version: "2.0",
        })
            .then((AMap: typeof window.AMap) => {
                if (cancelled || !mapRef.current) return;

                const center: [number, number] = [
                    edit.location.longitude,
                    edit.location.latitude,
                ];
                const map = new AMap.Map(mapRef.current, {
                    zoom: 16,
                    center,
                    viewMode: "2D",
                    mapStyle: "amap://styles/normal",
                    showLabel: true,
                });

                mapInstanceRef.current = map;
                map.on("moveend", syncCenter);
                map.on("zoomend", syncCenter);
                syncCenter();
                setLoading(false);
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                console.error(t("map-error-load-failed"), err);
                setError(
                    err instanceof Error
                        ? err.message
                        : t("map-error-load-failed"),
                );
                setLoading(false);
            });

        return () => {
            cancelled = true;
            const map = mapInstanceRef.current;
            if (map) {
                map.off("moveend", syncCenter);
                map.off("zoomend", syncCenter);
                map.destroy();
                mapInstanceRef.current = null;
            }
        };
    }, [edit, shouldRenderMap, syncCenter, t]);

    return (
        <PopupLayout
            title={t("map-location-picker-title")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col gap-3 overflow-hidden pt-2 relative items-center">
                <div className="w-full relative flex-1 min-h-[320px] overflow-hidden border bg-muted/30">
                    <div ref={mapRef} className="h-full w-full" />
                    {!error && (
                        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                            <i className="icon-[mdi--map-marker] size-10 -translate-y-5 text-red-600 drop-shadow-md" />
                        </div>
                    )}
                    {loading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background/70 text-sm text-muted-foreground">
                            <Loading />
                        </div>
                    )}
                    {error && (
                        <div className="absolute inset-0 flex items-center justify-center bg-background">
                            <div className="px-4 text-center">
                                <i className="icon-[mdi--alert-circle-outline] mx-auto mb-2 size-8 text-destructive" />
                                <div className="text-sm text-muted-foreground">
                                    {error}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="absolute bottom-6 flex flex-col gap-2 justify-center items-center">
                    <div className="text-center text-xs text-muted-foreground bg-background/50 p-[2px] rounded backdrop-blur-md">
                        {selectedLocation.latitude.toFixed(6)},{" "}
                        {selectedLocation.longitude.toFixed(6)}
                    </div>
                    <div className="">
                        <Button
                            size="sm"
                            disabled={!!error || loading}
                            onClick={() => onConfirm?.(selectedLocation)}
                        >
                            {t("map-location-picker-confirm")}
                        </Button>
                    </div>
                </div>
            </div>
        </PopupLayout>
    );
}

const [LocationPickerProvider, showLocationPicker] = createConfirmProvider<
    LocationPickerValue,
    GeoLocation
>(LocationPickerForm, {
    dialogTitle: "map-location-picker-title",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(640px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[560px]",
});

export { LocationPickerProvider, showLocationPicker };
