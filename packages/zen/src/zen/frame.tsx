import type { ReactNode } from "react";
import { useIntl } from "../i18n";
import { cn } from "../utils";
import type { ZenStyleName } from "./date";

export function ZenFrame({
    styleName,
    header,
    pending,
    onClose,
    closeLabel,
    children,
}: {
    styleName: ZenStyleName;
    header: ReactNode;
    pending?: boolean;
    onClose?: () => void;
    closeLabel?: string;
    children: ReactNode;
}) {
    const t = useIntl();
    return (
        <div
            data-status={pending ? "loading" : "ready"}
            className={cn(
                "zen-root zen-text zen-gradient-drift relative isolate h-full overflow-hidden",
                `zen-style-${styleName}`,
                pending && "zen-gradient-focus",
            )}
        >
            <div className="zen-overlay pointer-events-none absolute inset-0" />
            <div className="zen-frame relative z-10 mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col">
                <div className="zen-header-bar flex shrink-0 items-center justify-between gap-3 rounded-full px-3 py-2">
                    <div className="min-w-0">{header}</div>
                    {onClose && (
                        <button
                            type="button"
                            aria-label={closeLabel ?? t("zen-close")}
                            className="zen-close-btn grid size-11 shrink-0 place-items-center rounded-full transition"
                            onClick={onClose}
                        >
                            <i
                                aria-hidden="true"
                                className="icon-[mdi--close] size-5"
                            />
                        </button>
                    )}
                </div>
                {children}
            </div>
        </div>
    );
}
