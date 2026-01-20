/**
 * 高德地图 JS API 2.0 类型声明
 * 这里只声明了本项目使用到的部分 API
 */

export interface AMapSize {
    width: number;
    height: number;
}

export interface AMapPixel {
    x: number;
    y: number;
}

export interface AMapIcon {
    size: AMapSize;
    image: string;
    imageSize: AMapSize;
}

export interface AMapMarkerOptions {
    position: [number, number];
    title?: string;
    anchor?: string;
    icon?: AMapIcon;
}

export interface AMapMarker {
    on(event: string, handler: () => void): void;
    getPosition(): [number, number];
}

export interface AMapInfoWindowOptions {
    content: string;
    offset: AMapPixel;
}

export interface AMapInfoWindow {
    open(map: AMapMap, position: [number, number]): void;
}

export interface AMapMapOptions {
    zoom: number;
    center: [number, number];
    viewMode: "2D" | "3D";
    mapStyle?: string;
    showLabel?: boolean;
    pitch?: number;
}

export interface AMapMap {
    add(markers: AMapMarker | AMapMarker[]): void;
    remove(marker: AMapMarker): void;
    setFitView(
        markers?: AMapMarker[],
        immediately?: boolean,
        avoid?: number[],
    ): void;
    setCenter(center: [number, number]): void;
    setZoom(zoom: number): void;
    destroy(): void;
}

export interface AMapStatic {
    Map: new (container: HTMLElement, options: AMapMapOptions) => AMapMap;
    Marker: new (options: AMapMarkerOptions) => AMapMarker;
    Icon: new (options: Partial<AMapIcon>) => AMapIcon;
    InfoWindow: new (options: AMapInfoWindowOptions) => AMapInfoWindow;
    Size: new (width: number, height: number) => AMapSize;
    Pixel: new (x: number, y: number) => AMapPixel;
}

declare global {
    interface Window {
        AMap?: AMapStatic;
        _AMapSecurityConfig?: {
            securityJsCode: string;
        };
    }
}
