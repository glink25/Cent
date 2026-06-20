/**
 * 高德地图相关全局类型补充
 * 地图核心 API 类型由官方包 @amap/amap-jsapi-types 提供（全局 AMap 命名空间），
 * 这里仅补充官方类型未覆盖的安全密钥配置。
 */
import "@amap/amap-jsapi-types";

declare global {
    interface Window {
        _AMapSecurityConfig?: {
            securityJsCode: string;
        };
    }
}
