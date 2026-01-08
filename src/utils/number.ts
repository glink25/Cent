/**
 * 格式化数字，会将例如1.009转变为1.01
 * @param {number|string} num - 要格式化的数字
 * @param {number} maxDigits - 最大保留的小数位数
 */
export function toFixed(num: number, maxDigits: number) {
    // 1. 使用 toFixed 限制最大位数
    // 2. 使用 Number() 转换回数字，自动去除末尾的 0 和小数点
    return Number(Number(num).toFixed(maxDigits));
}

/**
 * 使用 Intl.NumberFormat 格式化数字为千分符
 * @param num 需要转换的数字
 * @param minimumFractionDigits 最小保留小数位
 * @param maximumFractionDigits 最大保留小数位
 */
export const toThousand = (
    num: number,
    minimumFractionDigits: number = 0,
    maximumFractionDigits: number = 20,
): string => {
    return new Intl.NumberFormat("en-US", {
        minimumFractionDigits,
        maximumFractionDigits,
    }).format(num);
};

/**
 * 将字节(Bytes)转换为最接近的可读单位字符串 (KB, MB, GB, etc.)
 * @param bytes 字节数值
 * @param decimals 保留的小数位数，默认为 2
 */
export const toFileSize = (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return "0 Bytes";

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

    // 计算单位的指数索引
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // 避免超出 sizes 数组范围
    const unitIndex = i < sizes.length ? i : sizes.length - 1;

    // 核心逻辑：数值 / (1024 ^ 指数)
    const value = parseFloat((bytes / k ** unitIndex).toFixed(dm));

    return `${value} ${sizes[unitIndex]}`;
};
