import dayjs from "dayjs";
import { numberToAmount } from "@/ledger/bill";
import { BillCategories } from "@/ledger/category";
import type { BillType } from "@/ledger/type";
import { intlCategory } from "@/ledger/utils";
import { t } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { requestAI } from "./request";

const getCategories = () => {
    const savedCategories = useLedgerStore.getState().infos?.meta.categories;

    const categories = (savedCategories ?? BillCategories).map((v) => {
        const cate = intlCategory(v, t);
        return cate;
    });
    return categories;
};

const textToBillSystemPrompt = (categoriesStr: string) => {
    const parts: string[] = [];

    // 基础信息
    parts.push("## 当前环境信息");
    parts.push("");
    parts.push(`**当前时间**: ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
    parts.push("");
    return `请通过给出的记账系统分类信息数据，从用户提供的文本中提取出关键的分类、金额和备注信息，使其能够准确快速地录入记账系统中，请严格按照给定规范给出回答
${parts.join("\n")}
下面是用户所有的分类：
\`\`\`plaintext
${categoriesStr}
\`\`\`
请严格按照xml规范返回你的分析结果，格式如下：
<Thought>
此处记录你的思考过程。
1. 根据文本分析用户想要录入的账单的类型（支出或收入）。
2. 根据用户想要录入的账单的类型，从用户所有的分类中选择一个分类，注意只能从已有的分类中选择，不能自己新增分类。
3. 根据文本内容，分析出用户想要录入的账单的金额
4. 根据文本内容，分析出用户想要录入的账单的备注，备注可能包含多个关键词，需要将多个关键词用空格分隔。
5. 根据文本内容，分析出用户想要录入的账单对应的发生时间，需要注意用户文本中的时间描述性语句，并推测出较为准确的24小时制时间，例如【今天】【昨天】【上午】【下午】【晚上】等，时间格式为YYYY-MM-DD HH:mm，注意多笔账单时可能需要格外注意不同账单的发生时间，并分别为每笔账单返回对应的时间。如果没有特定时间描述，一般使用当前时间即可。
6. 判断是否需要分成多笔账单分别记录，如果需要，则返回多笔账单的记录结果，每笔账单的记录结果使用Bill标签包裹，格式如下：
</Thought>
<Bill>
type=支出
category=餐饮
amount=100
note=备注
time=2026-01-01 12:00:00
</Bill>
接下来用户将会提供文本供你分析：
`;
};

/**
 * 账单记录类型
 */
export interface ParsedBill {
    type: BillType;
    category: string;
    amount: number;
    note?: string;
    time?: Date;
}

/**
 * 解析 AI 返回的文本为账单数组
 * @param result AI 返回的原始 XML 格式字符串
 * @returns 解析后的账单数组
 */
function parseBillsFromResponse(result: string): ParsedBill[] {
    const bills: ParsedBill[] = [];

    // 使用正则表达式提取所有的 <Bill> 标签
    const billRegex = /<Bill>([\s\S]*?)(?:<\/Bill>|$)/gi;
    let match: RegExpExecArray | null;

    // biome-ignore lint/suspicious/noAssignInExpressions: <explanation>
    while ((match = billRegex.exec(result)) !== null) {
        const billContent = match[1].trim();

        // 解析 Bill 标签内的 key=value 格式
        const lines = billContent
            .split(/\r?\n/)
            .map((l) => l.trim())
            .filter(Boolean);

        const billData: Partial<ParsedBill> = {};

        for (const line of lines) {
            const parts = line.split("=");
            if (parts.length < 2) continue;

            const key = parts[0].trim();
            const value = parts
                .slice(1)
                .join("=")
                .trim()
                .replace(/^["']|["']$/g, ""); // 移除可能的引号

            switch (key) {
                case "type":
                    if (value === "支出" || value === "expense") {
                        billData.type = "expense";
                    } else if (value === "收入" || value === "income") {
                        billData.type = "income";
                    }
                    break;
                case "category":
                    billData.category = value;
                    break;
                case "amount": {
                    // 解析金额为数字
                    const parsedAmount = Number.parseFloat(value);
                    if (!Number.isNaN(parsedAmount)) {
                        billData.amount = parsedAmount;
                    }
                    break;
                }
                case "note":
                    billData.note = value;
                    break;
                case "time":
                    billData.time = new Date(value);
                    break;
            }
        }

        // 验证必填字段是否存在
        if (
            billData.type &&
            billData.category &&
            billData.amount !== undefined
        ) {
            bills.push(billData as ParsedBill);
        }
    }

    return bills;
}

export async function parseTextToBill(text: string) {
    console.log("start parsing text:", text);

    const categories = getCategories();
    // 按照支出：xxx xxx,收入:xxx xxx的格式将categories转为字符串
    const incomes = categories
        .filter((v) => v.type === "expense")
        .map((v) => `${v.name}`)
        .join("\n");
    const expenses = categories
        .filter((v) => v.type === "income")
        .map((v) => `${v.name}`)
        .join("\n");

    const categoriesStr = `支出：\n${expenses},\n收入：${incomes}`;
    const prompt = textToBillSystemPrompt(categoriesStr);
    const result = await requestAI([
        { role: "system", content: prompt },
        {
            role: "user",
            content: `需要分析的文本：
            \`\`\`plaintext\n${text}\n\`\`\`
            `,
        },
    ]);
    // 通过xml格式解析result，参考chat.ts中的parseStandardResponse，注意可能会有多个账单，需要返回一个数组
    const rawBills = parseBillsFromResponse(result);
    console.log("parsed bills:", rawBills);
    const bills = rawBills
        .map((raw) => {
            const type = raw.type;
            const categoryId = categories.find(
                (v) => v.name === raw.category && v.type === type,
            )?.id;
            if (!categoryId) {
                return undefined;
            }
            const amount = numberToAmount(raw.amount);
            const comment = raw.note;
            const time = raw.time?.getTime() ?? Date.now();
            return {
                type,
                categoryId,
                amount,
                comment,
                time,
            };
        })
        .filter((v) => v !== undefined);
    return bills;
}

// const testTextToBill = async (
//     testText = "今天在餐饮上花了100元，买了一些吃的",
// ) => {
//     const result = await parseTextToBill(testText);
//     console.log(result);
// };

// window.testTextToBill = testTextToBill;
