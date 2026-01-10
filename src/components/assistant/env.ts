import dayjs from "dayjs";
import { BillCategories } from "@/ledger/category";
import type { BillFilterView } from "@/ledger/extra-type";
import { useLedgerStore } from "@/store/ledger";
import type { ViewType } from "../stat/date-slice";
import type { FocusType } from "../stat/focus-type";

export type EnvArg = {
    filterView?: BillFilterView;
    focusType?: FocusType;
    viewType?: ViewType;
    range: number[];
};

export function getEnvPrompt(env?: EnvArg) {
    if (!env) {
        return "";
    }

    const store = useLedgerStore.getState();
    const meta = store.infos?.meta;
    const creators = store.infos?.creators ?? [];

    // 获取所有分类（默认分类 + 自定义分类）
    const allCategories = [...BillCategories, ...(meta?.categories ?? [])];

    // 获取所有标签
    const allTags = meta?.tags ?? [];

    const parts: string[] = [];

    // 基础信息
    parts.push("## 当前环境信息");
    parts.push("");
    parts.push(`**当前时间**: ${dayjs().format("YYYY-MM-DD HH:mm:ss")}`);
    parts.push("");

    // 过滤视图信息
    if (env.filterView) {
        parts.push("### 当前选中的过滤视图");
        parts.push(`- **视图名称**: ${env.filterView.name}`);
        if (env.filterView.displayCurrency) {
            parts.push(`- **显示货币**: ${env.filterView.displayCurrency}`);
        }
        parts.push("");

        const filter = env.filterView.filter;

        // 时间范围
        if (filter.start || filter.end) {
            const startStr = filter.start
                ? dayjs(filter.start).format("YYYY-MM-DD")
                : "不限";
            const endStr = filter.end
                ? dayjs(filter.end).format("YYYY-MM-DD")
                : "不限";
            parts.push(`- **时间范围**: ${startStr} 至 ${endStr}`);
        }

        // 账单类型
        if (filter.type) {
            const typeName =
                filter.type === "income"
                    ? "收入"
                    : filter.type === "expense"
                      ? "支出"
                      : "全部";
            parts.push(`- **账单类型**: ${typeName}`);
        }

        // 分类
        if (filter.categories && filter.categories.length > 0) {
            const categoryNames = filter.categories
                .map((id) => allCategories.find((c) => c.id === id)?.name ?? id)
                .filter(Boolean);
            parts.push(`- **分类**: ${categoryNames.join("、")}`);
        }

        // 标签
        if (filter.tags && filter.tags.length > 0) {
            const tagNames = filter.tags
                .map((id) => allTags.find((t) => t.id === id)?.name ?? id)
                .filter(Boolean);
            parts.push(`- **包含标签**: ${tagNames.join("、")}`);
        }

        // 排除标签
        if (filter.excludeTags && filter.excludeTags.length > 0) {
            const excludeTagNames = filter.excludeTags
                .map((id) => allTags.find((t) => t.id === id)?.name ?? id)
                .filter(Boolean);
            parts.push(`- **排除标签**: ${excludeTagNames.join("、")}`);
        }

        // 创建者
        if (filter.creators && filter.creators.length > 0) {
            const creatorNames = filter.creators
                .map(
                    (id) =>
                        creators.find((c) => c.id === id)?.name ?? String(id),
                )
                .filter(Boolean);
            parts.push(`- **创建者**: ${creatorNames.join("、")}`);
        }

        // 金额范围
        if (filter.minAmountNumber !== undefined) {
            parts.push(
                `- **最小金额**: ${(filter.minAmountNumber / 10000).toFixed(2)} 元`,
            );
        }
        if (filter.maxAmountNumber !== undefined) {
            parts.push(
                `- **最大金额**: ${(filter.maxAmountNumber / 10000).toFixed(2)} 元`,
            );
        }

        // 其他过滤条件
        if (filter.comment) {
            parts.push(`- **关键词搜索**: ${filter.comment}`);
        }
        if (filter.assets !== undefined) {
            parts.push(`- **包含资产**: ${filter.assets ? "是" : "否"}`);
        }
        if (filter.scheduled !== undefined) {
            parts.push(`- **包含周期记账**: ${filter.scheduled ? "是" : "否"}`);
        }
        if (filter.currencies && filter.currencies.length > 0) {
            parts.push(`- **货币**: ${filter.currencies.join("、")}`);
        }

        parts.push("");
    }

    // 时间切片信息
    if (env.viewType) {
        parts.push("### 当前时间切片视图");
        const viewTypeNames: Record<ViewType, string> = {
            weekly: "周视图",
            monthly: "月视图",
            yearly: "年视图",
            custom: "自定义视图",
        };
        parts.push(
            `- **视图类型**: ${viewTypeNames[env.viewType] || env.viewType}`,
        );
        parts.push("");
    }

    // 当前选中的时间范围
    if (env.range && env.range.length === 2) {
        const [start, end] = env.range;
        const startStr = dayjs(start).format("YYYY-MM-DD");
        const endStr = dayjs(end).format("YYYY-MM-DD");
        parts.push("### 当前选中的时间范围");
        parts.push(`- **开始时间**: ${startStr}`);
        parts.push(`- **结束时间**: ${endStr}`);
        parts.push("");
    }

    // 焦点类型
    if (env.focusType) {
        parts.push("### 当前焦点类型");
        const focusTypeNames: Record<FocusType, string> = {
            income: "收入",
            expense: "支出",
            balance: "余额",
        };
        parts.push(
            `- **焦点类型**: ${focusTypeNames[env.focusType] || env.focusType}`,
        );
        parts.push("");
    }

    // 提示信息
    parts.push("---");
    parts.push("");
    parts.push(
        "以上信息可以帮助你更好地理解用户当前的上下文。当用户询问账单相关问题时，请考虑这些过滤条件和时间范围。",
    );

    return parts.join("\n");
}
