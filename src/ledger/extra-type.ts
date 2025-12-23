import type { BillType } from "./type";

/** 标签组可以快捷收纳标签，可以略过
 */
export type BillTagGroup = {
    name: string;
    id: string;
    color: string;
    /** 是否单选，开启后该标签组最多只能选中一个 */
    singleSelect?: boolean;
    /** 是否必选，开启后该标签组必须选择一个（默认选择第一个标签） */
    required?: boolean;
    tagIds?: string[];
};

/**
 * 预算，不需要转换预算，可以略过
 */
export type Budget = {
    id: string;
    title: string;
    start: number;
    end?: number;
    repeat: {
        unit: "week" | "day" | "month" | "year";
        value: number;
    };
    joiners: (string | number)[];
    totalBudget: number;
    categoriesBudget?: {
        id: string;
        budget: number;
    }[];
    onlyTags?: string[];
    excludeTags?: string[];
};

/**
 * 过滤器，不需要转换，可以略过
 */
export type BillFilter = Partial<{
    comment: string;
    recent?: {
        value: number;
        unit: "year" | "month" | "week" | "day";
    };
    start: number;
    end: number;
    type: BillType | undefined;
    creators: (string | number)[];
    categories: string[];
    minAmountNumber: number;
    maxAmountNumber: number;
    assets?: boolean;
    tags?: string[];
    baseCurrency: string;
    currencies?: string[];
}>;

// 个人配置，不需要转换，可以略过
export type PersonalMeta = {
    names?: Record<string, string>;
    rates?: Record<string, number>;
    tagGroups?: BillTagGroup[];
};

export type CustomCurrency = {
    id: string;
    name: string;
    symbol: string;
    rateToBase: number;
};
