import { useEffect, useState } from "react";
import Loading from "./components/loading";
import { useIntl, ZenI18nProvider } from "./i18n";
import { type ZenRuntime, ZenRuntimeContext } from "./runtime/context";
import { loadRuntime } from "./runtime/host";
import type { ZenRuntimeHost } from "./runtime/types";
import { getZenStyleName } from "./zen/date";
import { ZenExperience } from "./zen/dialog";
import { ZenFrame } from "./zen/frame";

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
                if (active) {
                    setRuntime({ host, ...value });
                    setError(undefined);
                }
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

    const themeClass = runtime?.init.theme === "dark" ? "dark" : "";
    return (
        <div
            className={`${themeClass} ${className ?? ""}`.trim()}
            style={{ width: "100%", height: "100%" }}
        >
            <ZenI18nProvider
                locale={
                    runtime?.init.locale ??
                    (globalThis.document?.documentElement.lang.startsWith("en")
                        ? "en"
                        : "zh")
                }
            >
                {runtime && !error ? (
                    <ZenRuntimeContext.Provider value={runtime}>
                        <ZenExperience onCancel={onClose} />
                    </ZenRuntimeContext.Provider>
                ) : (
                    <ZenStartup error={error} onClose={onClose} />
                )}
            </ZenI18nProvider>
        </div>
    );
}

function ZenStartup({
    error,
    onClose,
}: {
    error?: string;
    onClose?: () => void;
}) {
    const t = useIntl();
    return (
        <ZenFrame
            styleName={getZenStyleName()}
            pending={error === undefined}
            onClose={onClose}
            header={
                <p className="px-1 text-xs uppercase tracking-[0.2em] zen-text-muted">
                    {t("zen-header-label")}
                </p>
            }
        >
            <div className="zen-card zen-scroll relative min-h-0 flex-1 overflow-y-auto rounded-[2rem] p-5 sm:p-7">
                {error !== undefined ? (
                    <div role="alert">
                        <h2 className="text-2xl font-semibold zen-heading">
                            {t("zen-error-title")}
                        </h2>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 zen-text-muted">
                            {error}
                        </p>
                    </div>
                ) : (
                    <output className="grid min-h-full place-content-center justify-items-center gap-3 text-center text-sm zen-text-muted">
                        <Loading className="[&_i]:size-6" />
                        {t("zen-loading-open")}
                    </output>
                )}
            </div>
        </ZenFrame>
    );
}
