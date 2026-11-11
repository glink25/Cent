import {
    type ReactNode,
    type RefObject,
    useEffect,
    useRef,
    useState,
} from "react";
import type { GeoLocation } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { isCoordinate } from "./map/protocol";

type LocationError =
    | "location-permission-denied"
    | "location-timeout"
    | "location-unavailable";

interface CurrentLocationProps {
    onValueChange?: (data: GeoLocation) => void;
    onError?: (error: LocationError) => void;
    children?: ReactNode;
    className?: string;
    ref?: RefObject<HTMLButtonElement | null>;
}

export default function CurrentLocation({
    onValueChange,
    onError,
    children,
    className,
    ref,
}: CurrentLocationProps) {
    const t = useIntl();
    const request = useRef(0);
    const [loading, setLoading] = useState(false);
    useEffect(
        () => () => {
            request.current++;
        },
        [],
    );
    if (!navigator.geolocation) return null;

    const getLocation = () => {
        const id = ++request.current;
        setLoading(true);
        navigator.geolocation.getCurrentPosition(
            ({ coords: { latitude, longitude, accuracy } }) => {
                if (request.current !== id) return;
                setLoading(false);
                if (
                    !isCoordinate(latitude, longitude) ||
                    !Number.isFinite(accuracy) ||
                    accuracy < 0
                ) {
                    onError?.("location-unavailable");
                    return;
                }
                onValueChange?.({ latitude, longitude, accuracy });
            },
            (error) => {
                if (request.current !== id) return;
                setLoading(false);
                onError?.(
                    error.code === 1
                        ? "location-permission-denied"
                        : error.code === 3
                          ? "location-timeout"
                          : "location-unavailable",
                );
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
        );
    };

    return (
        <button
            ref={ref}
            type="button"
            onClick={getLocation}
            disabled={loading}
            className={cn(className)}
            aria-label={t("map-current-location")}
            title={t("map-current-location")}
        >
            {children}
        </button>
    );
}
