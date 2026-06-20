import type React from "react";
import { type ReactNode, type RefObject, useCallback, useState } from "react";
import type { GeoLocation } from "@/ledger/type";
import { cn } from "@/utils";

interface CurrentLocationProps {
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

const CurrentLocation: React.FC<CurrentLocationProps> = ({
    onValueChange,
    onError,
    children,
    className,
    ref,
}) => {
    // const handleError = useCallback(
    // 	(error: GeolocationPositionError) => {
    // 		setIsLoading(false);
    // 		let errorMessage: string;

    // 		switch (error.code) {
    // 			case error.PERMISSION_DENIED:
    // 				errorMessage = "权限被拒绝：请授权网站访问您的位置。";
    // 				break;
    // 			case error.POSITION_UNAVAILABLE:
    // 				errorMessage = "位置信息不可用：请检查您的设备定位服务是否开启。";
    // 				break;
    // 			case error.TIMEOUT:
    // 				errorMessage = "请求超时：无法在规定时间内获取位置。";
    // 				break;
    // 			default:
    // 				errorMessage = "发生未知定位错误。";
    // 				break;
    // 		}
    // 		onValueChange(null, error);
    // 	},
    // 	[onValueChange],
    // );

    const getLocation = () => {
        if (!("geolocation" in navigator)) {
            return;
        }
        // 调用 Geolocation API
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;

                // 整理需要回调的数据
                const data: GeoLocation = {
                    latitude,
                    longitude,
                    accuracy,
                };

                // 成功回调
                onValueChange?.(data);
            },
            onError,
            {
                enableHighAccuracy: true,
                timeout: 10000, // 10秒超时
                maximumAge: 0, // 不使用缓存
            },
        );
    };
    if (!("geolocation" in navigator)) {
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
