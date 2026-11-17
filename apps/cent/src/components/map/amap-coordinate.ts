import { isCoordinate } from "./protocol";

export type AMapPoint = [longitude: number, latitude: number];

// The JS API accepts at most 40 pairs per request.
export async function toAMap(
    sdk: typeof window.AMap,
    points: AMapPoint[],
    signal: AbortSignal,
): Promise<AMapPoint[]> {
    const converted: AMapPoint[] = [];
    for (let start = 0; start < points.length; start += 40) {
        signal.throwIfAborted();
        const batch = points.slice(start, start + 40);
        const result = await new Promise<AMapPoint[]>((resolve, reject) => {
            const abort = () => {
                finish();
                reject(signal.reason);
            };
            const fail = () => {
                finish();
                reject(new Error("AMap coordinate conversion failed"));
            };
            const timeout = window.setTimeout(fail, 10000);
            const finish = () => {
                window.clearTimeout(timeout);
                signal.removeEventListener("abort", abort);
            };
            signal.addEventListener("abort", abort, { once: true });
            try {
                sdk.convertFrom(
                    batch,
                    "gps",
                    (
                        _status: string,
                        result?: { info?: string; locations?: AMap.LngLat[] },
                    ) => {
                        finish();
                        const locations = result?.locations;
                        if (
                            result?.info !== "ok" ||
                            locations?.length !== batch.length ||
                            !locations.every(
                                (p) => p && isCoordinate(p.lat, p.lng),
                            )
                        ) {
                            fail();
                            return;
                        }
                        resolve(
                            locations.map((point) => [point.lng, point.lat]),
                        );
                    },
                );
            } catch (error) {
                finish();
                reject(error);
            }
        });
        converted.push(...result);
    }
    return converted;
}

// Invert the SDK's forward transform by correcting the residual at each step.
export async function fromAMap(
    sdk: typeof window.AMap,
    target: AMapPoint,
    signal: AbortSignal,
): Promise<AMapPoint> {
    let estimate = target;
    for (let attempt = 0; attempt < 5; attempt++) {
        const [projected] = await toAMap(sdk, [estimate], signal);
        const dx = target[0] - projected[0];
        const dy = target[1] - projected[1];
        if (Math.max(Math.abs(dx), Math.abs(dy)) <= 0.00001) return estimate;
        estimate = [estimate[0] + dx, estimate[1] + dy];
        if (!isCoordinate(estimate[1], estimate[0])) break;
    }
    throw new Error("AMap coordinate inversion did not converge");
}
