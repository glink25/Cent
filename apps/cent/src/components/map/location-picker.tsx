import { Component, type ReactNode, Suspense, useState } from "react";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import Loading from "../loading";
import PickerLayout from "./picker-layout";
import type { MapProvider, PickerProps, PickResult } from "./protocol";

type PickerRequest = {
    Picker: NonNullable<MapProvider["Picker"]>;
    initial?: PickerProps["initial"];
};

class PickerErrorBoundary extends Component<
    { children: ReactNode; fallback: ReactNode },
    { failed: boolean }
> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? this.props.fallback : this.props.children;
    }
}

function PickerDialog({
    Picker,
    initial,
    onResult,
}: PickerRequest & Pick<PickerProps, "onResult">) {
    const t = useIntl();
    const [attempt, setAttempt] = useState(0);
    const retry = () => setAttempt((value) => value + 1);
    return (
        <PickerErrorBoundary
            key={attempt}
            fallback={
                <PickerLayout
                    loading={false}
                    error={t("map-error-load-failed")}
                    canConfirm={false}
                    onConfirm={() => {}}
                    onCancel={() => onResult({ kind: "cancelled" })}
                    onRetry={retry}
                >
                    {null}
                </PickerLayout>
            }
        >
            <Suspense fallback={<Loading className="h-full justify-center" />}>
                <Picker initial={initial} onResult={onResult} onRetry={retry} />
            </Suspense>
        </PickerErrorBoundary>
    );
}

const [LocationPickerProvider, openPicker] = createConfirmProvider<
    PickerRequest,
    PickResult
>(
    ({ edit, onConfirm }) =>
        edit ? (
            <PickerDialog
                {...edit}
                onResult={(result) => onConfirm?.(result)}
            />
        ) : null,
    {
        dialogTitle: "map-location-picker-title",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(640px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[560px]",
    },
);

async function showLocationPicker(request: PickerRequest): Promise<PickResult> {
    try {
        return await openPicker(request);
    } catch {
        return { kind: "cancelled" };
    }
}

export { LocationPickerProvider, showLocationPicker };
