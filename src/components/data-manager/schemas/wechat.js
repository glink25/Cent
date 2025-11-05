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
    const csvHead = [
        "交易时间", // 0
        "交易类型", // 1
        "交易对方", // 2
        "商品", // 3
        "收/支", // 4
        "金额(元)", // 5
        "支付方式", // 6
        "当前状态", // 7
        "交易单号", // 8
        "商户单号", // 9
        "备注", // 10
    ];

    const cMap = {
        餐饮: "food",
        饭: "food",
        外卖: "food",
        肯德基: "food",
        KFC: "food",
        茶: "food",
        滴滴: "taxi",
        公交: "bus",
        地铁: "subway",
        打车: "taxi",
        话费: "phone",
        电费: "electricity",
        水费: "water",
        房租: "rent",
        物业: "mgmt-fee",
        购物: "shopping",
        淘宝: "shopping",
        京东: "shopping",
        拼多多: "shopping",
        超市: "household",
        服饰: "clothing",
        鞋: "clothing",
        电影: "movies",
        旅游: "travel",
        酒: "drinks",
        娱乐: "entertainment",
        医疗: "clinic",
        药房: "pharmacy",
        学费: "tuition",
        书: "books",
        课程: "courses",
        红包: "hongbao",
        转账: "relationship",
        亲属: "family",
        礼物: "gifts",
        理财通: "balance-account",
        提现: "balance-account",
        充值: "balance-account-income",
        工资: "wage",
        退款: "refund",
        收款: "other-income",
        服务费: "fees-charges",
        手续费: "fees-charges",
        优剪: "household", // 归类为家庭服务
    };

    /**
     * 将带有货币符号和逗号的字符串转换为浮点数。
     * 它会移除所有非数字字符（除了小数点）。
     *
     * @param {string} currencyString - 要转换的字符串，例如 "¥324.00" 或 "$1,234.56"。
     * @returns {number} 转换后的浮点数。
     */
    function convertCurrencyToNumber(currencyString) {
        if (typeof currencyString !== "string") {
            // 处理非字符串输入，例如 null 或 undefined
            return NaN;
        }

        // 1. 使用正则表达式移除所有非数字字符和非小数点字符。
        //    - `/[^0-9.]/g` 匹配所有不是数字 (0-9) 和不是小数点 (.) 的字符。
        //    - '' (空字符串) 替换这些匹配到的字符。
        const numberString = currencyString.replace(/[^0-9.]/g, "");

        // 2. 使用 parseFloat() 将清理后的字符串转换为浮点数。
        return parseFloat(numberString);
    }

    const getCategory = (name) => {
        const target = Array.from(Object.entries(cMap)).find(([key]) => {
            if (name.includes(key)) {
                return true;
            }
            return false;
        });
        return target?.[1];
    };

    const numberToAmount = (v) => Number((v * 10000).toFixed(0));
    const fileBuffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = e.target.result;
            resolve(data);
        };
        reader.onerror = reject;
        reader.readAsArrayBuffer(file);
    });
    const workbook = await ctx.XLSX.read(fileBuffer, {
        type: "array",
    });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const dataArray = XLSX.utils.sheet_to_json(worksheet, {
        header: 1, // 设置 header: 1 会返回一个二维数组，包含所有行
    });

    const bills = [];
    dataArray.slice(17).forEach((item) => {
        const billType =
            item[4] === "收入"
                ? "income"
                : item[4] === "支出"
                  ? "expense"
                  : undefined;
        if (billType === undefined) {
            // 忽略不计支出
            return;
        }
        const time = new Date(item[0]).getTime();
        const categoryId =
            getCategory(item[2]) ??
            (billType === "income" ? "other-income" : "other-expenses");
        const comment = [1, 2, 3].map((i) => `${item[i]}`).join(" ");
        const amount = numberToAmount(convertCurrencyToNumber(item[5]));
        const bill = {
            id: `${item[8]}-wechat`,
            type: billType,
            time,
            categoryId,
            comment: `${comment} wechat`,
            amount,
            creatorId: "from-wechat",
        };
        bills.push(bill);
    });
    return {
        items: bills,
        meta: undefined,
    };
}
