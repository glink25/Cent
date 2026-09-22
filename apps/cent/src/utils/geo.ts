/**
 * WGS-84 与 GCJ-02（国测局加密坐标）双向转换
 *
 * 本应用坐标存储统一使用 WGS-84（GPS 通用坐标，跨端一致），
 * 仅在渲染高德地图（GCJ-02 坐标系）时做展示层转换：
 * 浏览器 Geolocation API 返回 WGS-84，高德定位/地图选点返回 GCJ-02，
 * 直接混用会产生约 100~700 米的固定偏移。正算为业界通用近似算法，
 * 精度约 1~2 米；反算用迭代法，收敛到厘米级。中国境外坐标原样返回。
 */
const PI = Math.PI;
const SEMI_MAJOR_AXIS = 6378245.0; // 克拉索夫斯基椭球长半轴
const ECCENTRICITY_SQUARED = 0.006693421622965943; // 第一偏心率平方

const transformLat = (x: number, y: number) => {
    let ret =
        -100.0 +
        2.0 * x +
        3.0 * y +
        0.2 * y * y +
        0.1 * x * y +
        0.2 * Math.sqrt(Math.abs(x));
    ret +=
        ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) *
            2.0) /
        3.0;
    ret +=
        ((20.0 * Math.sin(y * PI) + 40.0 * Math.sin((y / 3.0) * PI)) * 2.0) /
        3.0;
    ret +=
        ((160.0 * Math.sin((y / 12.0) * PI) +
            320.0 * Math.sin((y * PI) / 30.0)) *
            2.0) /
        3.0;
    return ret;
};

const transformLng = (x: number, y: number) => {
    let ret =
        300.0 +
        x +
        2.0 * y +
        0.1 * x * x +
        0.1 * x * y +
        0.1 * Math.sqrt(Math.abs(x));
    ret +=
        ((20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) *
            2.0) /
        3.0;
    ret +=
        ((20.0 * Math.sin(x * PI) + 40.0 * Math.sin((x / 3.0) * PI)) * 2.0) /
        3.0;
    ret +=
        ((150.0 * Math.sin((x / 12.0) * PI) +
            300.0 * Math.sin((x / 30.0) * PI)) *
            2.0) /
        3.0;
    return ret;
};

/** 是否在中国大陆坐标范围外（境外无加密偏移，无需转换） */
const outOfChina = (lng: number, lat: number) =>
    lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;

/** WGS-84 经纬度转 GCJ-02，返回 [lng, lat] */
export const wgs84ToGcj02 = (lng: number, lat: number): [number, number] => {
    if (outOfChina(lng, lat)) {
        return [lng, lat];
    }
    let dLat = transformLat(lng - 105.0, lat - 35.0);
    let dLng = transformLng(lng - 105.0, lat - 35.0);
    const radLat = (lat / 180.0) * PI;
    let magic = Math.sin(radLat);
    magic = 1 - ECCENTRICITY_SQUARED * magic * magic;
    const sqrtMagic = Math.sqrt(magic);
    dLat =
        (dLat * 180.0) /
        (((SEMI_MAJOR_AXIS * (1 - ECCENTRICITY_SQUARED)) /
            (magic * sqrtMagic)) *
            PI);
    dLng =
        (dLng * 180.0) /
        ((SEMI_MAJOR_AXIS / sqrtMagic) * Math.cos(radLat) * PI);
    return [lng + dLng, lat + dLat];
};

/**
 * GCJ-02 经纬度转 WGS-84（迭代反算，收敛到厘米级精度），返回 [lng, lat]。
 * 用于把高德定位/地图选点结果换算回通用坐标存储。
 */
export const gcj02ToWgs84 = (lng: number, lat: number): [number, number] => {
    if (outOfChina(lng, lat)) {
        return [lng, lat];
    }
    let wgsLng = lng;
    let wgsLat = lat;
    for (let i = 0; i < 3; i++) {
        const [gLng, gLat] = wgs84ToGcj02(wgsLng, wgsLat);
        wgsLng += lng - gLng;
        wgsLat += lat - gLat;
    }
    return [wgsLng, wgsLat];
};
