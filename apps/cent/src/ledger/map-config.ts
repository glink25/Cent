import { decodeApiKey } from "@/utils/api-key";
import type { GlobalMeta } from "./type";

export type MapConfig = GlobalMeta["map"];
export type MapProviderId = NonNullable<
    NonNullable<MapConfig>["defaultProvider"]
>;

export function defaultMapProvider(config: MapConfig): MapProviderId {
    return config?.defaultProvider === "google" ? "google" : "amp";
}

export function readMapConfig(config: MapConfig) {
    return {
        amp: {
            key: decodeApiKey(config?.amapKey ?? ""),
            securityCode: decodeApiKey(config?.amapSecurityCode ?? ""),
        },
        google: {
            key: decodeApiKey(config?.googleKey ?? ""),
            mapId: config?.googleMapId ?? "",
        },
    };
}

export function hasMapConfig(config: MapConfig) {
    return Boolean(
        (config?.amapKey && config.amapSecurityCode) ||
            (config?.googleKey && config.googleMapId),
    );
}
