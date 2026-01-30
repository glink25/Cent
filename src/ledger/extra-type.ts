import type { Bill, BillType } from "./type";

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
    scheduled?: boolean;
    tags?: string[];
    excludeTags?: string[];
    baseCurrency: string;
    currencies?: string[];
}>;

export type BillFilterView = {
    id: string;
    filter: BillFilter;
    name: string;
    displayCurrency?: string;
};

/** 周期记账配置 */
export type Scheduled = {
    id: string;
    title: string;
    start: number;
    end?: number;
    template: Omit<Bill, "id" | "creatorId">;
    enabled?: boolean;
    repeat: {
        unit: "week" | "day" | "month" | "year";
        value: number;
    };
    // 最新一条自动记账记录的时间
    latest?: number;
};

// AI配置类型
export type AIConfig = {
    id: string;
    name: string;
    apiKey: string; // base64 encoded
    apiUrl: string;
    model: string;
    apiType: "open-ai-compatible" | "google-ai-studio"; // 支持OpenAI兼容和Google AI Studio两种API格式
};

// 个人配置，不需要转换，可以略过
export type PersonalMeta = {
    names?: Record<string, string>;
    rates?: Record<string, number>;
    tagGroups?: BillTagGroup[];
    scheduleds?: Scheduled[];
    customCSS?: string;
    assistant?: {
        bigmodel?: {
            apiKey?: string;
        };
        configs?: AIConfig[];
        defaultConfigId?: string;
    };
};

export type CustomCurrency = {
    id: string;
    name: string;
    symbol: string;
    rateToBase: number;
};
