import AMapLoader from "@amap/amap-jsapi-loader";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "@/locale";
import { type AMapPoint, fromAMap, toAMap } from "./amap-coordinate";
import PickerLayout from "./picker-layout";
import { billDetails, type MapProvider, type PickerProps } from "./protocol";
import "./amap-types";

const DEFAULT_CENTER: AMapPoint = [116.397428, 39.90923];
type Config = { key: string; securityCode: string };
let loadedConfig: Config | undefined;

async function load({
    key,
    securityCode,
}: Config): Promise<typeof window.AMap> {
    if (
        loadedConfig &&
        (key !== loadedConfig.key || securityCode !== loadedConfig.securityCode)
    ) {
        throw new Error("reload");
    }
    loadedConfig = { key, securityCode };
    window._AMapSecurityConfig = { securityJsCode: securityCode };
    return AMapLoader.load({ key, version: "2.0" });
}

function AMapPicker({
    config,
    initial,
    onResult,
    onRetry,
}: PickerProps & { config: Config }) {
    const t = useIntl();
    const element = useRef<HTMLDivElement>(null);
    const session = useRef<{
        sdk: typeof window.AMap;
        map: AMap.Map;
        center: AMapPoint;
        signal: AbortSignal;
    }>(null);
    const [ready, setReady] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const container = element.current;
        if (!container) return;
        void (async () => {
            try {
                const sdk = await load(config);
                const [center] = initial
                    ? await toAMap(
                          sdk,
                          [[initial.longitude, initial.latitude]],
                          signal,
                      )
                    : [DEFAULT_CENTER];
                if (signal.aborted) return;
                const map = new sdk.Map(container, {
                    zoom: initial ? 16 : 12,
                    center,
                    viewMode: "2D",
                });
                const start = map.getCenter();
                session.current = {
                    sdk,
                    map,
                    center: [start.lng, start.lat],
                    signal,
                };
                setReady(true);
            } catch (error) {
                if (!signal.aborted)
                    setError(
                        t(
                            error instanceof Error && error.message === "reload"
                                ? "map-reload-required"
                                : "map-error-load-failed",
                        ),
                    );
            }
        })();
        return () => {
            controller.abort();
            session.current?.map.destroy();
            session.current = null;
        };
    }, [config, initial, t]);

    async function confirm() {
        if (!session.current || busy) return;
        const { sdk, map, center, signal } = session.current;
        const point = map.getCenter();
        if (!point) return;
        if (
            initial &&
            Math.abs(point.lng - center[0]) < 1e-7 &&
            Math.abs(point.lat - center[1]) < 1e-7
        ) {
            onResult({ kind: "unchanged" });
            return;
        }
        setBusy(true);
        try {
            const [longitude, latitude] = await fromAMap(
                sdk,
                [point.lng, point.lat],
                signal,
            );
            if (!signal.aborted)
                onResult({
                    kind: "selected",
                    location: { latitude, longitude, accuracy: 0 },
                });
        } catch {
            if (!signal.aborted) {
                setBusy(false);
                setError(t("map-coordinate-failed"));
            }
        }
    }

    return (
        <PickerLayout
            loading={!ready || busy}
            error={error}
            onRetry={
                error === t("map-coordinate-failed")
                    ? () => setError("")
                    : onRetry
            }
            canConfirm={ready}
            onCancel={() => onResult({ kind: "cancelled" })}
            onConfirm={confirm}
        >
            <div ref={element} className="h-full w-full" />
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                <i className="icon-[mdi--map-marker] size-10 -translate-y-5 text-red-600 drop-shadow-md" />
            </div>
        </PickerLayout>
    );
}

export function createAMapProvider(config: Config): MapProvider {
    return {
        identity: "amp",
        Picker: (props) => <AMapPicker {...props} config={config} />,
        async mount(element, signal) {
            const sdk = await load(config);
            signal.throwIfAborted();
            const map = new sdk.Map(element, {
                zoom: 12,
                center: DEFAULT_CENTER,
                viewMode: "2D",
            });
            const info = new sdk.InfoWindow({ offset: new sdk.Pixel(0, -30) });
            let markers: AMap.Marker[] = [];
            return {
                async render(bills, labels, renderSignal) {
                    const positions = await toAMap(
                        sdk,
                        bills.map(({ location }) => [
                            location.longitude,
                            location.latitude,
                        ]),
                        renderSignal,
                    );
                    renderSignal.throwIfAborted();
                    info.close();
                    map.remove(markers);
                    markers = bills.map((bill, index) => {
                        const position = positions[index];
                        const marker = new sdk.Marker({
                            position,
                            anchor: "bottom-center",
                        });
                        marker.on("click", () => {
                            info.setContent(billDetails(bill, labels));
                            info.open(map, position);
                        });
                        return marker;
                    });
                    if (markers.length) map.add(markers);
                    if (markers.length > 1)
                        map.setFitView(markers, false, [40, 40, 40, 40]);
                    else {
                        map.setCenter(positions[0] ?? DEFAULT_CENTER);
                        map.setZoom(markers.length ? 15 : 12);
                    }
                },
                dispose() {
                    info.close();
                    map.destroy();
                },
            };
        },
    };
}
