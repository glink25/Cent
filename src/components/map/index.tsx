import { useEffect, useRef, useState } from "react";
import type { Bill } from "@/ledger/type";
import type { AMapMap, AMapMarker } from "./amap-types";

interface AMapContainerProps {
    bills?: Pick<Bill, "location" | "id" | "amount">[];
    amapKey?: string;
    amapSecurityCode?: string;
}

export default function AMapContainer({
    bills,
    amapKey,
    amapSecurityCode,
}: AMapContainerProps) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<AMapMap | null>(null);
    const markersRef = useRef<AMapMarker[]>([]);
    const [error, setError] = useState<string>("");
    const [sdkLoaded, setSdkLoaded] = useState(false); // 跟踪SDK加载状态

    // 初始化地图（仅执行一次）
    useEffect(() => {
        if (!mapRef.current) return;

        // 检查 API Key 配置
        if (!amapKey) {
            setError("请配置高德地图 API Key");
            return;
        }

        // 设置安全密钥
        if (amapSecurityCode) {
            window._AMapSecurityConfig = {
                securityJsCode: amapSecurityCode,
            };
        }

        // 动态加载高德地图 JS API
        const loadAMap = () => {
            console.log("start load amap");
            return new Promise<void>((resolve, reject) => {
                if (window.AMap) {
                    resolve();
                    return;
                }

                const script = document.createElement("script");
                script.type = "text/javascript";
                script.src = `https://webapi.amap.com/maps?v=2.0&key=${amapKey}`;
                script.onload = () => resolve();
                script.onerror = () =>
                    reject(new Error("Amap API load failed"));
                document.head.appendChild(script);
            });
        };

        loadAMap()
            .then(() => {
                if (!mapRef.current || !window.AMap) return;

                // 创建地图实例（默认中心点）
                mapInstanceRef.current = new window.AMap.Map(mapRef.current, {
                    zoom: 12,
                    center: [116.397428, 39.90923], // 默认北京
                    viewMode: "2D",
                    mapStyle: "amap://styles/normal",
                    showLabel: true,
                });

                setSdkLoaded(true); // SDK加载完成
            })
            .catch((err) => {
                console.error("地图加载失败:", err);
                setError(err.message || "地图加载失败");
            });

        return () => {
            // 清理地图实例
            if (mapInstanceRef.current) {
                mapInstanceRef.current.destroy();
                mapInstanceRef.current = null;
            }
        };
    }, [amapKey, amapSecurityCode]); // 依赖API配置

    // 更新地图标记点（依赖SDK加载状态和bills数据）
    useEffect(() => {
        // 等待SDK加载完成和地图实例创建
        if (!sdkLoaded || !mapInstanceRef.current || !window.AMap) return;

        const mapInstance = mapInstanceRef.current;

        // 清除旧的标记点
        markersRef.current.forEach((marker) => {
            mapInstance.remove(marker);
        });
        markersRef.current = [];

        // 过滤出有地理位置的账单
        const billsWithLocation = bills?.filter((bill) => bill.location) || [];

        if (billsWithLocation.length === 0) {
            // 没有位置数据时，重置地图中心到默认位置
            mapInstance.setCenter([116.397428, 39.90923]);
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
        const markers: AMapMarker[] = billsWithLocation
            .map((bill) => {
                const { location, amount } = bill;
                if (!location || !window.AMap) return null;

                const marker = new window.AMap.Marker({
                    position: [location.longitude, location.latitude],
                    title: `金额: ¥${(amount / 10000).toFixed(2)}`,
                    anchor: "bottom-center",
                    // 自定义标记图标
                    icon: new window.AMap.Icon({
                        size: new window.AMap.Size(25, 34),
                        image: "//a.amap.com/jsapi_demos/static/demo-center/icons/poi-marker-default.png",
                        imageSize: new window.AMap.Size(25, 34),
                    }),
                });

                // 添加信息窗体
                const infoWindow = new window.AMap.InfoWindow({
                    content: `
                        <div style="padding: 12px; min-width: 150px;">
                            <p style="margin: 0; font-weight: bold; font-size: 14px; color: #333;">
                                金额: ¥${(amount / 10000).toFixed(2)}
                            </p>
                            <p style="margin: 8px 0 0 0; font-size: 12px; color: #999;">
                                位置精度: ${location.accuracy.toFixed(0)}m
                            </p>
                            <p style="margin: 4px 0 0 0; font-size: 11px; color: #ccc;">
                                ${location.latitude.toFixed(6)}, ${location.longitude.toFixed(6)}
                            </p>
                        </div>
                    `,
                    offset: new window.AMap.Pixel(0, -34),
                });

                marker.on("click", () => {
                    infoWindow.open(mapInstance, marker.getPosition());
                });

                return marker;
            })
            .filter((marker): marker is AMapMarker => marker !== null);

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
    }, [bills, sdkLoaded]); // 依赖bills和sdkLoaded状态

    // 错误状态
    if (error) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-muted/30 rounded-sm">
                <div className="text-center p-4">
                    <i className="icon-[mdi--alert-circle-outline] size-8 text-destructive mb-2"></i>
                    <p className="text-sm text-muted-foreground">{error}</p>
                    <p className="text-xs text-muted-foreground mt-2">
                        请在设置中配置地图 API Key
                    </p>
                </div>
            </div>
        );
    }

    return <div ref={mapRef} className="w-full h-full rounded-sm" />;
}
