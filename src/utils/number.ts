// 根据下面的函数，编写一个react Money组件，使其智能根据金额大小决定是否展示小数，并且小数部分单独使用div展示，便于定制样式
/**
 * 格式化数字
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
