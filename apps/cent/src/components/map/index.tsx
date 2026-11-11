import { useEffect, useRef, useState } from "react";
import { useIntl } from "@/locale";
import Loading from "../loading";
import { Button } from "../ui/button";
import type { MapBill, MapProvider, MapSession } from "./protocol";

export default function MapCanvas({
    provider,
    bills,
    onSettings,
}: {
    provider: MapProvider;
    bills: MapBill[];
    onSettings: () => void;
}) {
    const t = useIntl();
    const element = useRef<HTMLDivElement>(null);
    const [session, setSession] = useState<MapSession>();
    const [error, setError] = useState("");
    const [retry, setRetry] = useState(0);

    // biome-ignore lint/correctness/useExhaustiveDependencies: Retry starts a fresh SDK session.
    useEffect(() => {
        const container = element.current;
        if (!container || !provider.mount) return;
        const controller = new AbortController();
        const { signal } = controller;
        let active: MapSession | undefined;
        setSession(undefined);
        setError("");
        const onError = () => {
            if (!signal.aborted) setError(t("map-error-load-failed"));
        };
        void provider
            .mount(container, signal, onError)
            .then((mounted) => {
                if (signal.aborted) mounted.dispose();
                else {
                    active = mounted;
                    setSession(mounted);
                }
            })
            .catch((error) => {
                if (!signal.aborted)
                    setError(
                        t(
                            error instanceof Error && error.message === "reload"
                                ? "map-reload-required"
                                : "map-error-load-failed",
                        ),
                    );
            });
        return () => {
            controller.abort();
            active?.dispose();
        };
    }, [provider, retry, t]);

    useEffect(() => {
        if (!session) return;
        const controller = new AbortController();
        const { signal } = controller;
        void Promise.resolve()
            .then(() => {
                if (!signal.aborted)
                    return session.render(
                        bills,
                        {
                            amount: t("map-marker-amount"),
                            accuracy: t("map-marker-accuracy"),
                        },
                        signal,
                    );
            })
            .catch(() => {
                if (!signal.aborted) setError(t("map-error-load-failed"));
            });
        return () => controller.abort();
    }, [session, bills, t]);

    return (
        <div className="relative h-full w-full">
            <div ref={element} className="h-full w-full rounded-sm" />
            {!session && !error && (
                <div className="absolute inset-0 flex items-center justify-center bg-background">
                    <Loading />
                </div>
            )}
            {error && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background p-3 text-center text-sm">
                    <p role="alert">{error}</p>
                    <div className="flex gap-2">
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={onSettings}
                        >
                            {t("map-settings")}
                        </Button>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                if (error === t("map-reload-required"))
                                    window.location.reload();
                                else setRetry((value) => value + 1);
                            }}
                        >
                            {t(
                                error === t("map-reload-required")
                                    ? "map-reload"
                                    : "map-retry",
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
