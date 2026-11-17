import { lazy, useMemo } from "react";
import {
    defaultMapProvider,
    type MapConfig,
    readMapConfig,
} from "@/ledger/map-config";
import { useIntl } from "@/locale";
import PickerLayout from "./picker-layout";
import type { MapProvider, PickerProps } from "./protocol";

function UnavailablePicker({ onResult }: PickerProps) {
    const t = useIntl();
    return (
        <PickerLayout
            loading={false}
            error={t("map-error-load-failed")}
            canConfirm={false}
            onCancel={() => onResult({ kind: "cancelled" })}
            onConfirm={() => {}}
        >
            {null}
        </PickerLayout>
    );
}

function lazyProvider<T>(
    identity: string,
    config: T,
    create: () => Promise<(config: T) => MapProvider>,
): MapProvider {
    let provider: Promise<MapProvider> | undefined;
    const load = () => {
        provider ??= create()
            .then((factory) => factory(config))
            .catch((error) => {
                provider = undefined;
                throw error;
            });
        return provider;
    };
    const LazyPicker = lazy(async () => {
        const { Picker } = await load();
        return { default: Picker ?? UnavailablePicker };
    });
    return {
        identity,
        // The confirm store freezes its payload. Keep React.lazy's mutable
        // internals out of it by exposing an ordinary component function.
        Picker: (props) => <LazyPicker {...props} />,
        async mount(element, signal, onError) {
            const { mount } = await load();
            signal.throwIfAborted();
            if (!mount) throw new Error("Map rendering unavailable");
            return mount(element, signal, onError);
        },
    };
}

export function useMapProvider(config: MapConfig) {
    return useMemo(() => {
        const { amp, google } = readMapConfig(config);
        if (defaultMapProvider(config) === "google") {
            return google.key && google.mapId
                ? lazyProvider("google", google, () =>
                      import("./google").then(
                          (module) => module.createGoogleProvider,
                      ),
                  )
                : undefined;
        }
        return amp.key && amp.securityCode
            ? lazyProvider("amp", amp, () =>
                  import("./amap").then((module) => module.createAMapProvider),
              )
            : undefined;
    }, [config]);
}
