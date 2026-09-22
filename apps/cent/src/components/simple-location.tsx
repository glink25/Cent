import AMapLoader from "@amap/amap-jsapi-loader";
import type React from "react";
import type { ReactNode, RefObject } from "react";
import type { GeoLocation } from "@/ledger/type";
import { cn } from "@/utils";
import { gcj02ToWgs84 } from "@/utils/geo";

interface CurrentLocationProps {
    /** 配置了高德 Key 时优先使用高德定位（GCJ-02 反算为 WGS-84），失败时退回浏览器定位 */
    amapKey?: string;
    amapSecurityCode?: string;
    /**
     * 当成功获取到位置信息或发生错误时触发的回调函数。
     * @param data 成功时的位置数据，如果失败则为 null。
     * @param error 失败时的错误对象，如果成功则为 null。
     */
    onValueChange?: (data: GeoLocation) => void;
    onError?: (error: GeolocationPositionError) => void;
    /** 按钮的文本内容，默认为 "获取当前位置" */
    children?: ReactNode;
    className?: string;
    ref?: RefObject<HTMLButtonElement | null>;
}

/** 高德定位：返回 GCJ-02，统一反算为 WGS-84 输出（存储通用坐标） */
const locateByAMap = (amapKey: string, amapSecurityCode: string) =>
    new Promise<GeoLocation>((resolve, reject) => {
        window._AMapSecurityConfig = {
            securityJsCode: amapSecurityCode,
        };
        AMapLoader.load({
            key: amapKey,
            version: "2.0",
            plugins: ["AMap.Geolocation"],
        })
            .then((AMap: typeof window.AMap) => {
                const geolocation = new AMap.Geolocation({
                    enableHighAccuracy: true,
                    timeout: 10000,
                });
                geolocation.getCurrentPosition((status, result) => {
                    if (status === "complete" && result.position) {
                        const [lng, lat] = gcj02ToWgs84(
                            result.position.lng,
                            result.position.lat,
                        );
                        resolve({
                            latitude: lat,
                            longitude: lng,
                            accuracy: result.accuracy ?? 0,
                        });
                    } else {
                        reject(
                            new Error(result.message ?? "AMap locate failed"),
                        );
                    }
                });
            })
            .catch(reject);
    });

/** 浏览器定位：直接输出 WGS-84（通用坐标，无需转换） */
const locateByBrowser = () =>
    new Promise<GeoLocation>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                resolve({ latitude, longitude, accuracy });
            },
            reject,
            {
                enableHighAccuracy: true,
                timeout: 10000, // 10秒超时
                maximumAge: 0, // 不使用缓存
            },
        );
    });

const CurrentLocation: React.FC<CurrentLocationProps> = ({
    amapKey,
    amapSecurityCode,
    onValueChange,
    onError,
    children,
    className,
    ref,
}) => {
    const hasAMapConfig = Boolean(amapKey && amapSecurityCode);

    const getLocation = async () => {
        if (!hasAMapConfig && !("geolocation" in navigator)) {
            return;
        }
        try {
            const data = hasAMapConfig
                ? await locateByAMap(
                      amapKey as string,
                      amapSecurityCode as string,
                  ).catch(locateByBrowser)
                : await locateByBrowser();
            // 成功回调
            onValueChange?.(data);
        } catch (error) {
            onError?.(error as GeolocationPositionError);
        }
    };

    if (!hasAMapConfig && !("geolocation" in navigator)) {
        return null;
    }

    return (
        <button
            ref={ref}
            type="button"
            onClick={getLocation}
            className={cn(className)}
        >
            {children}
        </button>
    );
};

export default CurrentLocation;
