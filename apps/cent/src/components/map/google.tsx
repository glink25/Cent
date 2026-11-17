import { importLibrary, setOptions } from "@googlemaps/js-api-loader";
import { useEffect, useRef, useState } from "react";
import { useIntl } from "@/locale";
import PickerLayout from "./picker-layout";
import {
    billDetails,
    type MapProvider,
    type PickerProps,
    samePoint,
} from "./protocol";

type Config = { key: string; mapId: string };
const DEFAULT_CENTER = { lat: 39.90923, lng: 116.397428 };
let loadedKey: string | undefined;
let authFailed = false;
const authListeners = new Set<() => void>();

async function load(key: string, signal: AbortSignal, onError: () => void) {
    if (loadedKey && loadedKey !== key) throw new Error("reload");
    if (!loadedKey) {
        loadedKey = key;
        setOptions({ key, v: "quarterly" });
        Object.assign(window, {
            gm_authFailure() {
                authFailed = true;
                for (const listener of authListeners) listener();
            },
        });
    }
    if (authFailed) throw new Error("reload");
    authListeners.add(onError);
    signal.addEventListener("abort", () => authListeners.delete(onError), {
        once: true,
    });
    const [maps, marker] = await Promise.all([
        importLibrary("maps"),
        importLibrary("marker"),
    ]);
    signal.throwIfAborted();
    if (authFailed) throw new Error("reload");
    return { ...maps, ...marker };
}

function GooglePicker({
    config,
    initial,
    onResult,
    onRetry,
}: PickerProps & { config: Config }) {
    const t = useIntl();
    const element = useRef<HTMLDivElement>(null);
    const [ready, setReady] = useState(false);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState(initial);
    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const container = element.current;
        if (!container) return;
        const onError = () => setError(t("map-error-load-failed"));
        let dispose: (() => void) | undefined;
        void (async () => {
            try {
                const { Map: GoogleMap, AdvancedMarkerElement } = await load(
                    config.key,
                    signal,
                    onError,
                );
                const center = initial
                    ? { lat: initial.latitude, lng: initial.longitude }
                    : DEFAULT_CENTER;
                const map = new GoogleMap(container, {
                    center,
                    zoom: initial ? 16 : 12,
                    mapId: config.mapId,
                    clickableIcons: false,
                });
                const marker = new AdvancedMarkerElement(
                    initial ? { map, position: center } : {},
                );
                const click = map.addListener(
                    "click",
                    (event: google.maps.MapMouseEvent) => {
                        if (!event.latLng) return;
                        try {
                            const { lat, lng } = event.latLng.toJSON();
                            marker.position = { lat, lng };
                            marker.map = map;
                            setSelected({
                                latitude: lat,
                                longitude: lng,
                                accuracy: 0,
                            });
                        } catch {
                            onError();
                        }
                    },
                );
                const capabilities = map.addListener(
                    "mapcapabilities_changed",
                    () => {
                        if (
                            map.getMapCapabilities()
                                .isAdvancedMarkersAvailable === false
                        )
                            onError();
                    },
                );
                dispose = () => {
                    click.remove();
                    capabilities.remove();
                    marker.map = null;
                    container.replaceChildren();
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
            dispose?.();
        };
    }, [config, initial, t]);

    return (
        <PickerLayout
            loading={!ready}
            error={error}
            onRetry={onRetry}
            canConfirm={!!selected}
            onCancel={() => onResult({ kind: "cancelled" })}
            onConfirm={() => {
                if (!selected) return;
                onResult(
                    initial && samePoint(initial, selected)
                        ? { kind: "unchanged" }
                        : { kind: "selected", location: selected },
                );
            }}
        >
            <div ref={element} className="h-full w-full" />
            <div className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded bg-background/90 px-2 py-1 text-center text-xs shadow">
                {t("map-google-click-to-pick")}
            </div>
        </PickerLayout>
    );
}

export function createGoogleProvider(config: Config): MapProvider {
    return {
        identity: "google",
        Picker: (props) => <GooglePicker {...props} config={config} />,
        async mount(element, signal, onError) {
            const {
                Map: GoogleMap,
                AdvancedMarkerElement,
                InfoWindow,
            } = await load(config.key, signal, onError);
            const map = new GoogleMap(element, {
                center: DEFAULT_CENTER,
                zoom: 12,
                mapId: config.mapId,
                clickableIcons: false,
            });
            const info = new InfoWindow();
            const capabilities = map.addListener(
                "mapcapabilities_changed",
                () => {
                    if (
                        map.getMapCapabilities().isAdvancedMarkersAvailable ===
                        false
                    )
                        onError();
                },
            );
            let markers: {
                marker: google.maps.marker.AdvancedMarkerElement;
                click: google.maps.MapsEventListener;
            }[] = [];
            const clear = () => {
                info.close();
                for (const { marker, click } of markers) {
                    click.remove();
                    marker.map = null;
                }
                markers = [];
            };
            return {
                render(bills, labels) {
                    clear();
                    const bounds = new google.maps.LatLngBounds();
                    for (const bill of bills) {
                        const position = {
                            lat: bill.location.latitude,
                            lng: bill.location.longitude,
                        };
                        bounds.extend(position);
                        const marker = new AdvancedMarkerElement({
                            map,
                            position,
                            title: labels.amount,
                        });
                        const click = marker.addListener("click", () => {
                            info.setContent(billDetails(bill, labels));
                            info.open({ map, anchor: marker });
                        });
                        markers.push({ marker, click });
                    }
                    if (bills.length > 1) map.fitBounds(bounds, 40);
                    else {
                        map.setCenter(
                            bounds.isEmpty()
                                ? DEFAULT_CENTER
                                : bounds.getCenter(),
                        );
                        map.setZoom(bills.length ? 15 : 12);
                    }
                },
                dispose() {
                    clear();
                    capabilities.remove();
                    element.replaceChildren();
                },
            };
        },
    };
}
