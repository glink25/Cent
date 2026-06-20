import { useEffect, useState } from "react";
import { ZenI18nProvider } from "./i18n";
import { type ZenRuntime, ZenRuntimeContext } from "./runtime/context";
import { loadRuntime } from "./runtime/host";
import type { ZenRuntimeHost } from "./runtime/types";
import { ZenExperience } from "./zen/dialog";

export type ZenProps = {
    host: ZenRuntimeHost;
    onClose?: () => void;
    className?: string;
};

export function Zen({ host, onClose, className }: ZenProps) {
    const [runtime, setRuntime] = useState<ZenRuntime>();
    const [error, setError] = useState<string>();

    useEffect(() => {
        let active = true;
        loadRuntime(host)
            .then((value) => {
                if (active) setRuntime({ host, ...value });
            })
            .catch((reason) => {
                if (active)
                    setError(
                        reason instanceof Error
                            ? reason.message
                            : String(reason),
                    );
            });
        return () => {
            active = false;
        };
    }, [host]);

    if (error)
        return (
            <div className={className} role="alert">
                {error}
            </div>
        );
    if (!runtime) return <div className={className} aria-busy="true" />;

    const themeClass = runtime.init.theme === "dark" ? "dark" : "";
    return (
        <div
            className={`${themeClass} ${className ?? ""}`.trim()}
            style={{ width: "100%", height: "100%" }}
        >
            <ZenI18nProvider locale={runtime.init.locale ?? "zh"}>
                <ZenRuntimeContext.Provider value={runtime}>
                    <ZenExperience onCancel={onClose} />
                </ZenRuntimeContext.Provider>
            </ZenI18nProvider>
        </div>
    );
}
