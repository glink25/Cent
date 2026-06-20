export function shortId(): string {
    // 获取当前毫秒级时间戳
    const timestamp = Date.now();

    // 生成一个 0 到 99999 之间的随机数
    const random = Math.floor(Math.random() * 100000);

    // 将时间戳和随机数组合成一个大数
    // 这里用100000作为乘数，以确保随机数不会覆盖时间戳的最后几位
    const combinedNumber = timestamp * 100000 + random;

    // 将组合后的数字转换为 Base36 字符串，作为ID
    // Base36 使用0-9和a-z，比10进制更短
    const shortId = combinedNumber.toString(36);

    return shortId;
}
