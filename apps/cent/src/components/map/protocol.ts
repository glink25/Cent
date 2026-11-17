import type { ComponentType } from "react";
import type { Bill, GeoLocation } from "@/ledger/type";

export type MapBill = Pick<Bill, "id" | "amount"> & { location: GeoLocation };

export type PickResult =
    | { kind: "selected"; location: GeoLocation }
    | { kind: "unchanged" }
    | { kind: "cancelled" };

export interface PickerProps {
    initial?: GeoLocation;
    onResult: (result: PickResult) => void;
    onRetry: () => void;
}

export type MapLabels = { amount: string; accuracy: string };

export interface MapSession {
    render: (
        bills: MapBill[],
        labels: MapLabels,
        signal: AbortSignal,
    ) => void | Promise<void>;
    dispose: () => void;
}

export interface MapProvider {
    identity: string;
    Picker?: ComponentType<PickerProps>;
    mount?: (
        element: HTMLDivElement,
        signal: AbortSignal,
        onError: () => void,
    ) => Promise<MapSession>;
}

export function isCoordinate(latitude: number, longitude: number) {
    return (
        Number.isFinite(latitude) &&
        Math.abs(latitude) <= 90 &&
        Number.isFinite(longitude) &&
        Math.abs(longitude) <= 180
    );
}

export function samePoint(a: GeoLocation, b: GeoLocation) {
    return (
        Math.abs(a.latitude - b.latitude) < 1e-7 &&
        Math.abs(a.longitude - b.longitude) < 1e-7
    );
}

export function billDetails(bill: MapBill, labels: MapLabels) {
    const node = document.createElement("div");
    const { latitude, longitude, accuracy } = bill.location;
    for (const line of [
        `${labels.amount}: ${(bill.amount / 10000).toFixed(2)}`,
        `${labels.accuracy}: ${accuracy.toFixed(0)} m`,
        `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
    ]) {
        const row = document.createElement("div");
        row.textContent = line;
        node.append(row);
    }
    return node;
}
