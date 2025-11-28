import type { GeoLocation } from "@/ledger/type";

// 归一化参数
export type LocationBounds = {
    minLat: number;
    maxLat: number;
    minLng: number;
    maxLng: number;
};

// 辅助：周期性时间编码 (将 0-23 映射到圆上，使 23点和 0点接近)
function encodeCyclical(value: number, period: number): [number, number] {
    const theta = (2 * Math.PI * value) / period;
    return [Math.sin(theta), Math.cos(theta)];
}

// 输入特征向量维度: 7
// [SinDay, CosDay, SinHour, CosHour, IsWeekend, NormLat, NormLng]
export function extractFeatures(
    timestamp: number,
    geoLoc: GeoLocation | undefined,
    bounds?: LocationBounds,
): number[] {
    const date = new Date(timestamp);
    const day = date.getDay(); // 0-6
    const hour = date.getHours(); // 0-23
    const location = geoLoc ? [geoLoc.latitude, geoLoc.longitude] : undefined;

    // 1. 时间周期性 (4 dims)
    const [sinDay, cosDay] = encodeCyclical(day, 7);
    const [sinHour, cosHour] = encodeCyclical(hour, 24);

    // 2. 周末特征 (1 dim)
    const isWeekend = day === 0 || day === 6 ? 1 : 0;

    // 3. 地点归一化 (2 dims)
    let normLat = 0.5; // 默认中心
    let normLng = 0.5;

    if (location && bounds && bounds.maxLat - bounds.minLat > 0) {
        normLat =
            (location[0] - bounds.minLat) / (bounds.maxLat - bounds.minLat);
        normLng =
            (location[1] - bounds.minLng) / (bounds.maxLng - bounds.minLng);
    }

    return [sinDay, cosDay, sinHour, cosHour, isWeekend, normLat, normLng];
}

export function updateBounds(
    current: LocationBounds | undefined,
    geoLoc: GeoLocation,
): LocationBounds {
    const loc = [geoLoc.latitude, geoLoc.longitude];
    if (!current)
        return {
            minLat: loc[0],
            maxLat: loc[0],
            minLng: loc[1],
            maxLng: loc[1],
        };
    return {
        minLat: Math.min(current.minLat, loc[0]),
        maxLat: Math.max(current.maxLat, loc[0]),
        minLng: Math.min(current.minLng, loc[1]),
        maxLng: Math.max(current.maxLng, loc[1]),
    };
}
