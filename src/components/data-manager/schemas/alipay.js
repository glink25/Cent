/**
 * @typedef {Object} ExportedJSON
 * @property {Array} items
 * @property {Object} meta
 */

/**
 * @typedef {Object} File
 * @property {string} name - 文件名。
 * @property {number} size - 文件大小（字节）。
 * // 实际的 File 结构应根据您实际使用的 File 对象来定义，通常是浏览器中的 File 或 Node.js 中的文件对象
 */

/**
 * @typedef {Object} Context
 * @property {object} Papa - 专门用于解析CSV文件的第三方JS库。
 * @property {Function} Papa.parse - 用于解析CSV数据的方法。
 * @property {object} XLSX - 专门用于解析Excel文件的第三方JS库。
 * @property {Function} XLSX.read - 用于读取Excel文件的方法。
 */

/**
 * 转换文件并解析其内容为特定格式的JSON。
 *
 * @param {File} file - 需要转换的文件对象。
 * @param {Context} ctx - 包含第三方解析库的上下文对象。
 * @returns {Promise<ExportedJSON>} 转换后得到的JSON对象。
 */

async function transform(file, ctx) {
    const categoryMap = {
        餐饮美食: "food",
        交通出行: "transport",
        购物消费: "shopping",
        生活服务: "housing", // 包含水费电费等
        休闲娱乐: "entertainment",
        医疗健康: "medical",
        教育培训: "education",
        社交人情: "relationship",
        爱心公益: "charity", // 支出-其他
        投资理财: null, // 不纳入日常记账，或者归入不计收支
        转账: null, // 不纳入日常记账
        退款: "refund", // 收入-其他
        其他: "other-expenses",
        AA收款: "other-expenses",
    };
    const csvHead = [
        "交易时间", // 0
        "交易分类", // 1
        "交易对方", // 2
        "对方账号", // 3
        "商品说明", // 4
        "收/支", // 5
        "金额", // 6
        "收/付款方式", // 7
        "交易状态", // 8
        "交易订单号", // 9
        "商家订单号", // 10
        "备注", // 11
    ];
    const numberToAmount = (v) => Number((v * 10000).toFixed(0));
    const items = await new Promise((resolve, reject) => {
        const bills = [];
        ctx.Papa.parse(file, {
            encoding: "gbk",
            complete: (result) => {
                const dataRowIndex = result.data.findIndex((v) => v.length > 2);
                const flattedData = result.data[dataRowIndex];
                for (
                    let index = 0;
                    index < flattedData.length;
                    index += csvHead.length
                ) {
                    const item = flattedData
                        .slice(index, index + csvHead.length)
                        .map((str) => {
                            const value = str
                                .replace("\n", "")
                                .replace("\t", "");
                            return value;
                        });
                    const billType =
                        item[5] === "收入"
                            ? "income"
                            : item[5] === "支出"
                              ? "expense"
                              : undefined;
                    if (billType === undefined) {
                        // 忽略不计支出
                        continue;
                    }
                    const time = new Date(item[0]).getTime();
                    const categoryId =
                        categoryMap[item[1]] ??
                        (billType === "income"
                            ? "other-income"
                            : "other-expenses");
                    const comment = [2, 4, 1, 11]
                        .map((i) => `${item[i]}`)
                        .join(" ");
                    const amount = numberToAmount(Number(item[6]));
                    const bill = {
                        id: `${item[9]}-alipay`,
                        type: billType,
                        time,
                        categoryId,
                        comment: `${comment} alipay`,
                        amount,
                        creatorId: "from-alipay",
                    };
                    bills.push(bill);
                }
                resolve(bills);
            },
        });
    });
    return {
        items,
        meta: undefined,
    };
}
