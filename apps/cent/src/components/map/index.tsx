import AMapLoader from "@amap/amap-jsapi-loader";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import "./amap-types";

interface AMapContainerProps {
    bills?: Pick<Bill, "location" | "id" | "amount">[];
    amapKey?: string;
    amapSecurityCode?: string;
}

const DEFAULT_CENTER: [number, number] = [116.397428, 39.90923]; // 默认北京

export default function AMapContainer({
    bills,
    amapKey,
    amapSecurityCode,
}: AMapContainerProps) {
    const t = useIntl();
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<AMap.Map | null>(null);
    const markersRef = useRef<AMap.Marker[]>([]);
    const [error, setError] = useState<string>("");
    const [sdkLoaded, setSdkLoaded] = useState(false); // 跟踪SDK加载状态

    // 初始化地图（仅执行一次）
    useEffect(() => {
        if (!mapRef.current) return;

        // 检查 API Key 配置
        if (!amapKey) {
            setError(t("map-error-no-api-key"));
            return;
        }

        // 设置安全密钥（必须在 AMapLoader.load 之前设置）
        if (amapSecurityCode) {
            window._AMapSecurityConfig = {
                securityJsCode: amapSecurityCode,
            };
        }

        let cancelled = false;

        // 使用官方加载器加载高德地图 JS API
        AMapLoader.load({
            key: amapKey,
            version: "2.0",
        })
            .then((AMap: typeof window.AMap) => {
                if (cancelled || !mapRef.current) return;

                // 创建地图实例（默认中心点）
                mapInstanceRef.current = new AMap.Map(mapRef.current, {
                    zoom: 12,
                    center: DEFAULT_CENTER,
                    viewMode: "2D",
                    mapStyle: "amap://styles/normal",
                    showLabel: true,
                });

                setSdkLoaded(true); // SDK加载完成
            })
            .catch((err: unknown) => {
                if (cancelled) return;
                console.error(t("map-error-load-failed"), err);
                setError(
                    err instanceof Error
                        ? err.message
                        : t("map-error-load-failed"),
                );
            });

        return () => {
            cancelled = true;
            // 清理地图实例
            if (mapInstanceRef.current) {
                mapInstanceRef.current.destroy();
                mapInstanceRef.current = null;
            }
        };
    }, [amapKey, amapSecurityCode, t]); // 依赖API配置和翻译函数

    // 过滤出有地理位置的账单
    const billsWithLocation = useMemo(
        () => bills?.filter((bill) => bill.location) || [],
        [bills],
    );
    // 更新地图标记点（依赖SDK加载状态和bills数据）
    useEffect(() => {
        // 等待SDK加载完成和地图实例创建
        if (!sdkLoaded || !mapInstanceRef.current || !window.AMap) return;

        const AMap = window.AMap;
        const mapInstance = mapInstanceRef.current;

        // 清除旧的标记点
        markersRef.current.forEach((marker) => {
            mapInstance.remove(marker);
        });
        markersRef.current = [];

        if (billsWithLocation.length === 0) {
            // 没有位置数据时，重置地图中心到默认位置
            mapInstance.setCenter(DEFAULT_CENTER);
            mapInstance.setZoom(12);
            return;
        }

        // 计算地图中心点
        const avgLng =
            billsWithLocation.reduce(
                (sum, bill) => sum + (bill.location?.longitude || 0),
                0,
            ) / billsWithLocation.length;
        const avgLat =
            billsWithLocation.reduce(
                (sum, bill) => sum + (bill.location?.latitude || 0),
                0,
            ) / billsWithLocation.length;

        // 创建标记点
        const markers: AMap.Marker[] = billsWithLocation
            .map((bill) => {
                const { location, amount } = bill;
                if (!location) return null;

                const position: [number, number] = [
                    location.longitude,
                    location.latitude,
                ];
                const marker = new AMap.Marker({
                    position,
                    title: `${t("map-marker-amount")}: ${(amount / 10000).toFixed(2)}`,
                    anchor: "bottom-center",
                    // 自定义标记图标
                    icon: new AMap.Icon({
                        size: new AMap.Size(25, 34),
                        image: "//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png",
                        imageSize: new AMap.Size(25, 34),
                    }),
                });

                // 添加信息窗体
                const infoWindow = new AMap.InfoWindow({
                    content: `
                        <div style="padding: 12px; min-width: 150px;">
                            <p style="margin: 0; font-weight: bold; font-size: 14px; color: #333;">
                                ${t("map-marker-amount")}: ¥${(amount / 10000).toFixed(2)}
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
                                ${t("map-marker-accuracy")}: ${location.accuracy.toFixed(0)}m
                            </p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #ccc;">
                                ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
                            </p>
                        </div>
                    `,
                    offset: new AMap.Pixel(0, -34),
                });

                marker.on("click", () => {
                    infoWindow.open(mapInstance, position);
                });

                return marker;
            })
            .filter((marker): marker is AMap.Marker => marker !== null);

        // 添加标记点到地图
        if (markers.length > 0) {
            mapInstance.add(markers);
            markersRef.current = markers;

            // 自动调整地图视野以显示所有标记点
            if (markers.length > 1) {
                mapInstance.setFitView(markers, false, [60, 60, 60, 60]);
            } else {
                // 只有一个标记点时，设置中心点
                mapInstance.setCenter([avgLng, avgLat]);
                mapInstance.setZoom(15);
            }
        }
    }, [billsWithLocation, sdkLoaded, t]); // 依赖bills、sdkLoaded状态和翻译函数

    // 错误状态
    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-sm">
                <div className="text-center p-4">
                    <i className="icon-[mdi--alert-circle-outline] size-8 text-destructive mb-2"></i>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                        {t("map-error-configure-in-settings")}
                    </p>
                </div>
            </div>
        );
    }

    return <div ref={mapRef} className="w-full h-full rounded-sm" />;
}
