import { v4 } from "uuid";
import { importFromPreviewResult } from "@/components/data-manager/preview-form";
import type { Full } from "@/database/stash";
import { BillCategories } from "@/ledger/category";
import type { Bill, ExportedJSON, GlobalMeta } from "@/ledger/type";
import { useUserStore } from "@/store/user";

/** 模拟随机生成可以被 importFromPreviewResult 导入的账单数据，账单数据完美符合ExportedJSON的类型和注释要求
 * 并且能够模拟正常人的账单数据结构，收入和支出符合正常中产阶级的生活习惯，包含可读性较高的备注
 * 允许指定时间尺度，例如最近的12个月
 */
export function debugCreateMockBills(months: number): ExportedJSON {
    const now = Date.now();
    const startTime = now - months * 30 * 24 * 60 * 60 * 1000; // 从N个月前开始

    const bills: Full<Bill>[] = [];
    const categories = BillCategories;

    // 生成支出账单模板（中产阶级日常消费）
    const expenseTemplates: Array<{
        categoryId: string;
        amountRange: [number, number]; // 金额范围（元）
        frequency: number; // 每月频率
        comments: string[];
    }> = [
        // 餐饮
        {
            categoryId: "breakfast",
            amountRange: [15, 35],
            frequency: 20,
            comments: ["早餐", "包子豆浆", "煎饼果子", "小笼包", "肠粉"],
        },
        {
            categoryId: "launch",
            amountRange: [25, 60],
            frequency: 22,
            comments: ["午餐", "工作餐", "快餐", "盖浇饭", "麻辣烫"],
        },
        {
            categoryId: "dinner",
            amountRange: [40, 120],
            frequency: 18,
            comments: ["晚餐", "聚餐", "火锅", "烧烤", "家常菜"],
        },
        {
            categoryId: "snack",
            amountRange: [10, 50],
            frequency: 15,
            comments: ["零食", "奶茶", "咖啡", "甜品", "水果"],
        },
        {
            categoryId: "treat",
            amountRange: [80, 300],
            frequency: 4,
            comments: ["聚餐", "请客", "生日宴", "庆祝", "团建"],
        },
        // 交通
        {
            categoryId: "taxi",
            amountRange: [15, 80],
            frequency: 12,
            comments: ["打车", "滴滴", "出租车", "快车"],
        },
        {
            categoryId: "subway",
            amountRange: [3, 10],
            frequency: 40,
            comments: ["地铁", "轨道交通", "通勤"],
        },
        {
            categoryId: "bus",
            amountRange: [2, 5],
            frequency: 20,
            comments: ["公交", "巴士", "公交车"],
        },
        {
            categoryId: "parking",
            amountRange: [5, 30],
            frequency: 15,
            comments: ["停车费", "停车场", "路边停车"],
        },
        {
            categoryId: "gas-up",
            amountRange: [200, 500],
            frequency: 2,
            comments: ["加油", "92号汽油", "95号汽油"],
        },
        // 购物
        {
            categoryId: "clothing",
            amountRange: [100, 800],
            frequency: 2,
            comments: ["买衣服", "T恤", "裤子", "外套", "鞋子"],
        },
        {
            categoryId: "household",
            amountRange: [30, 200],
            frequency: 4,
            comments: ["日用品", "洗发水", "牙膏", "纸巾", "洗衣液"],
        },
        {
            categoryId: "electronics",
            amountRange: [500, 5000],
            frequency: 0.3,
            comments: ["手机", "耳机", "充电器", "数据线", "键盘"],
        },
        // 住房
        {
            categoryId: "rent",
            amountRange: [2000, 6000],
            frequency: 1,
            comments: ["房租", "月租"],
        },
        {
            categoryId: "mortgage",
            amountRange: [3000, 8000],
            frequency: 1,
            comments: ["房贷", "月供"],
        },
        {
            categoryId: "electricity",
            amountRange: [100, 300],
            frequency: 1,
            comments: ["电费", "电费账单"],
        },
        {
            categoryId: "water",
            amountRange: [30, 80],
            frequency: 1,
            comments: ["水费", "水费账单"],
        },
        {
            categoryId: "phone",
            amountRange: [50, 150],
            frequency: 1,
            comments: ["话费", "手机费", "套餐费"],
        },
        {
            categoryId: "mgmt-fee",
            amountRange: [200, 500],
            frequency: 1,
            comments: ["物业费", "管理费"],
        },
        // 娱乐
        {
            categoryId: "movies",
            amountRange: [40, 120],
            frequency: 2,
            comments: ["看电影", "影院", "IMAX"],
        },
        {
            categoryId: "fitness",
            amountRange: [200, 500],
            frequency: 1,
            comments: ["健身房", "健身卡", "私教课"],
        },
        {
            categoryId: "travel",
            amountRange: [1000, 5000],
            frequency: 0.3,
            comments: ["旅游", "旅行", "度假", "酒店"],
        },
        // 医疗
        {
            categoryId: "pharmacy",
            amountRange: [50, 300],
            frequency: 1,
            comments: ["买药", "感冒药", "维生素", "保健品"],
        },
        {
            categoryId: "clinic",
            amountRange: [200, 2000],
            frequency: 0.5,
            comments: ["医院", "体检", "看病", "检查"],
        },
        // 教育
        {
            categoryId: "courses",
            amountRange: [500, 5000],
            frequency: 0.5,
            comments: ["培训", "课程", "学习", "网课"],
        },
        // 其他
        {
            categoryId: "fees-charges",
            amountRange: [20, 200],
            frequency: 5,
            comments: ["其他", "杂项", "临时支出", "手续费"],
        },
    ];

    // 生成收入账单模板
    const incomeTemplates: Array<{
        categoryId: string;
        amountRange: [number, number]; // 金额范围（元）
        frequency: number; // 每月频率
        comments: string[];
    }> = [
        {
            categoryId: "wage",
            amountRange: [8000, 20000],
            frequency: 1,
            comments: ["工资", "月薪", "薪资"],
        },
        {
            categoryId: "part-time",
            amountRange: [500, 3000],
            frequency: 0.5,
            comments: ["兼职", "外快", "副业"],
        },
        {
            categoryId: "lean",
            amountRange: [100, 1000],
            frequency: 0.3,
            comments: ["红包", "转账", "礼金"],
        },
        {
            categoryId: "gifts-income",
            amountRange: [200, 2000],
            frequency: 0.2,
            comments: ["礼物", "生日礼物", "节日礼物"],
        },
        {
            categoryId: "refund",
            amountRange: [50, 500],
            frequency: 1,
            comments: ["退款", "退货退款", "订单退款"],
        },
    ];

    // 生成账单的辅助函数
    const generateBills = (
        templates: typeof expenseTemplates,
        type: "expense" | "income",
        months: number,
    ) => {
        const totalDays = months * 30;

        templates.forEach((template) => {
            const category = categories.find(
                (c) => c.id === template.categoryId,
            );
            if (!category) return;

            const totalCount = Math.floor(template.frequency * months);

            for (let i = 0; i < totalCount; i++) {
                // 随机分布在时间范围内
                const randomDay = Math.floor(Math.random() * totalDays);
                const randomHour = Math.floor(Math.random() * 24);
                const randomMinute = Math.floor(Math.random() * 60);
                const time =
                    startTime +
                    randomDay * 24 * 60 * 60 * 1000 +
                    randomHour * 60 * 60 * 1000 +
                    randomMinute * 60 * 1000;

                // 确保时间不超过现在
                const billTime = Math.min(time, now);

                // 随机金额（元转分，需要乘以10000）
                // 70%概率是整数，30%概率是1位小数
                const isInteger = Math.random() < 0.7;
                let amountYuan: number;
                if (isInteger) {
                    // 生成整数
                    const min = Math.ceil(template.amountRange[0]);
                    const max = Math.floor(template.amountRange[1]);
                    amountYuan =
                        min + Math.floor(Math.random() * (max - min + 1));
                } else {
                    // 生成1位小数
                    const rawAmount =
                        template.amountRange[0] +
                        Math.random() *
                            (template.amountRange[1] - template.amountRange[0]);
                    amountYuan = Math.round(rawAmount * 10) / 10;
                }
                const amount = Math.round(amountYuan * 10000);

                // 随机备注
                const comment =
                    template.comments[
                        Math.floor(Math.random() * template.comments.length)
                    ];

                // 生成账单ID和时间戳
                const id = v4();
                const createAt = billTime;
                const updateAt = billTime;

                bills.push({
                    id,
                    type,
                    categoryId: template.categoryId,
                    creatorId: useUserStore.getState().id,
                    comment,
                    amount,
                    time: billTime,
                    __create_at: createAt,
                    __update_at: updateAt,
                });
            }
        });
    };

    // 生成支出账单
    generateBills(expenseTemplates, "expense", months);

    // 生成收入账单
    generateBills(incomeTemplates, "income", months);

    // 按时间排序
    bills.sort((a, b) => a.time - b.time);

    // 构建meta
    const meta: GlobalMeta = {
        tags: [],
        baseCurrency: "CNY",
    };

    return {
        items: bills,
        meta,
    };
}

(
    window as Window & { debugFillMockBills?: () => Promise<void> }
).debugFillMockBills = async () => {
    const debugData = debugCreateMockBills(12);
    await importFromPreviewResult({
        bills: debugData.items,
        meta: debugData.meta,
        strategy: "overlap",
    });
};
