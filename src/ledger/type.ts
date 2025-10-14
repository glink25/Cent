export type BillType = "income" | "expense";

export type Amount = number;

export type GeoLocation = {
    latitude: number;
    longitude: number;
    accuracy: number;
};

export type BillCategory = {
    type: BillType;
    name: string;
    id: string;
    icon: string;
    color: string;
    customName?: boolean;
    parent?: string;
};

export type Bill = {
    id: string;
    type: BillType;
    categoryId: string;
    creatorId: number | string;
    comment?: string;
    /** 整数金额，10000:1 */
    amount: Amount;
    time: number;
    // _created_at: number;
    // _updated_at: number;
    images?: (File | string)[];
    location?: GeoLocation;
    tagIds?: string[];
};

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
}>;
