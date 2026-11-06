import type { ReactNode } from "react";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import Loading from "../loading";
import { Button } from "../ui/button";

export default function PickerLayout({
    children,
    loading,
    error,
    canConfirm,
    onCancel,
    onConfirm,
    onRetry,
}: {
    children: ReactNode;
    loading: boolean;
    error: string;
    canConfirm: boolean;
    onCancel: () => void;
    onConfirm: () => void;
    onRetry?: () => void;
}) {
    const t = useIntl();
    return (
        <PopupLayout
            title={t("map-location-picker-title")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="relative flex-1 min-h-0">
                {children}
                {loading && !error && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/70">
                        <Loading />
                    </div>
                )}
                {error && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background p-4 text-center">
                        <p role="alert">{error}</p>
                        {onRetry && (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                    if (error === t("map-reload-required"))
                                        window.location.reload();
                                    else onRetry();
                                }}
                            >
                                {t(
                                    error === t("map-reload-required")
                                        ? "map-reload"
                                        : "map-retry",
                                )}
                            </Button>
                        )}
                    </div>
                )}
            </div>
            <div className="flex justify-center p-3">
                <Button
                    size="sm"
                    disabled={!canConfirm || loading || !!error}
                    onClick={onConfirm}
                >
                    {t("map-location-picker-confirm")}
                </Button>
            </div>
        </PopupLayout>
    );
}
