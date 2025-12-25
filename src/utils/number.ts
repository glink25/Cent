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
