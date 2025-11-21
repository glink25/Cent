import dayjs, { type Dayjs } from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { numberToAmount } from "./bill";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

import { DefaultCurrencyId as DefaultBaseCurrencyId } from "@/api/currency/currencies";
import { BillCategories } from "./category";
import type { Bill, BillCategory, BillFilter, BillType } from "./type";

const isTypeMatched = (bill: Bill, type?: BillType) => {
    if (type === undefined) return true;
    return bill.type === type;
};

export const isTimeMatched = (
    bill: Bill,
    _start?: Dayjs | string | number,
    _end?: Dayjs | string | number,
    recent?: BillFilter["recent"],
) => {
    const d = dayjs.unix(bill.time / 1000);
    const { start, end } = (() => {
        if (recent) {
            const now = dayjs();
            return {
                start: now.subtract(recent.value, recent.unit).startOf("day"),
                end: undefined,
            };
        }
        const start =
            _start === undefined
                ? undefined
                : typeof _start === "number"
                  ? dayjs.unix(_start / 1000)
                  : dayjs(_start);
        const end =
            _end === undefined
                ? undefined
                : typeof _end === "number"
                  ? dayjs.unix(_end / 1000)
                  : dayjs(_end);
        return { start, end };
    })();
    if (start) {
        if (end) {
            return d.isSameOrAfter(start) && d.isSameOrBefore(end);
        }
        return d.isSameOrAfter(start);
    }
    if (end) {
        return d.isSameOrBefore(end);
    }
    return true;
};

const isMoneyMatched = (
    bill: Bill,
    _minNumber = -Infinity,
    _maxNumber = Infinity,
) => {
    const _min = numberToAmount(_minNumber);
    const _max = numberToAmount(_maxNumber);
    const [min, max] = _min < _max ? [_min, _max] : [_max, _min];
    return bill.amount <= max && bill.amount >= min;
};
const isUserMatched = (bill: Bill, uids?: (string | number)[]) => {
    return uids?.length ? uids.some((u) => bill.creatorId === u) : true;
};
const isCateMatched = (bill: Bill, cates?: string[]) => {
    return cates?.length ? cates.some((c) => bill.categoryId === c) : true;
};

const isCommentMatched = (bill: Bill, comment?: string) => {
    return comment ? Boolean(bill.comment?.includes(comment)) : true;
};

const isAssetsMatched = (bill: Bill, assets?: boolean) => {
    return assets === true ? bill.images?.some((img) => Boolean(img)) : true;
};

const isTagsMatched = (bill: Bill, tagIds?: string[]) => {
    return tagIds?.length
        ? tagIds.some((c) => bill.tagIds?.some((t) => t === c))
        : true;
};

const isCurrenciesMatched = (
    bill: Bill,
    base: string,
    currencies?: string[],
) => {
    return currencies?.length
        ? currencies.some((c) => (bill.currency?.target ?? base) === c)
        : true;
};

export const isBillMatched = (bill: Bill, filter: BillFilter) => {
    return (
        isTypeMatched(bill, filter.type) &&
        isUserMatched(bill, filter.creators) &&
        isCateMatched(bill, filter.categories) &&
        isMoneyMatched(bill, filter.minAmountNumber, filter.maxAmountNumber) &&
        isTimeMatched(bill, filter.start, filter.end, filter.recent) &&
        isAssetsMatched(bill, filter.assets) &&
        isCommentMatched(bill, filter.comment) &&
        isTagsMatched(bill, filter.tags) &&
        isCurrenciesMatched(
            bill,
            filter.baseCurrency ?? DefaultBaseCurrencyId,
            filter.currencies,
        )
    );
};

export const treeCategories = (categories: BillCategory[]) => {
    return categories.reduce(
        (p, c) => {
            if (!c.parent) {
                p.push({ ...c, children: [] });
                return p;
            }
            const parent = p.find((x) => x.id === c.parent);
            if (!parent) {
                return p;
            }
            parent.children.push(c);
            return p;
        },
        [] as (BillCategory & { children: BillCategory[] })[],
    );
};

export const intlCategory = <
    T extends Pick<BillCategory, "customName" | "name"> | undefined,
>(
    c: T,
    t: any,
): T => {
    if (c === undefined) {
        return c;
    }
    return { ...c, name: c.customName ? c.name : t(c.name) };
};

export const categoriesGridClassName = (cs: BillCategory[] | undefined) =>
    cs?.some((v) => v.name.length > 2)
        ? "grid-cols-[repeat(auto-fill,minmax(120px,1fr))]"
        : "grid-cols-[repeat(auto-fill,minmax(80px,1fr))]";

/**
 * 属性合并辅助函数：处理 A, B, Default 三者之间的冲突
 */
function mergeProperties(
    key: keyof BillCategory,
    valA: any,
    valB: any,
    valD: any,
): any {
    // 1. 如果 B 中没有该属性，或者值完全一样，保留 A 的值（或者 B 的值，反正一样）
    if (valB === undefined || valA === valB) {
        return valA;
    }

    // 2. 如果没有默认值参考，直接以 B 为准 (覆盖模式)
    if (valD === undefined) {
        return valB;
    }

    // 3. 三方比对逻辑
    const isAChanged = valA !== valD;
    const isBChanged = valB !== valD;

    if (isAChanged && !isBChanged) {
        // A 改了，B 没改 -> 用户想保留自己的修改，忽略 B 的默认值
        return valA;
    } else if (!isAChanged && isBChanged) {
        // A 没改，B 改了 -> 应用 B 的更新
        return valB;
    } else {
        // 冲突：A 和 B 都改了，或者都没改
        // 规则："重复元素以B中的为准"
        return valB;
    }
}

/**
 * 核心合并函数
 * @param categoriesA 本地数组 (决定排序优先)
 * @param categoriesB 新数组 (提供新数据和新元素)
 * @param defaultCategories 默认配置数组 (用于比对差异)
 */
export function appendCategories(
    categoriesA: BillCategory[],
    categoriesB: BillCategory[],
    defaultCategories: BillCategory[] = BillCategories,
): BillCategory[] {
    // 1. 建立索引，优化查找速度
    const mapB = new Map(categoriesB.map((c) => [c.id, c]));
    const mapDefault = new Map(defaultCategories.map((c) => [c.id, c]));

    // 记录 A 中已有的 ID，用于后续找出 B 的新增项
    const idsInA = new Set<string>();

    // 2. 遍历 A (保留 A 的顺序)
    const mergedList = categoriesA.map((itemA) => {
        idsInA.add(itemA.id);

        const itemB = mapB.get(itemA.id);

        // 情况 1: B 中没有这个 ID -> 完全保留 A
        if (!itemB) {
            return itemA;
        }

        // 情况 2: A 和 B 都有 -> 进行属性合并
        const itemDefault = mapDefault.get(itemA.id);

        // 创建一个新对象，以 A 为底
        const finalItem: BillCategory = { ...itemA };

        // 遍历 B 的所有属性，尝试覆盖或合并到 finalItem
        // 使用 keyof 确保类型安全
        (Object.keys(itemB) as Array<keyof BillCategory>).forEach((key) => {
            const valA = itemA[key];
            const valB = itemB[key];
            // 注意：如果 default 中没有这个元素，valD 为 undefined
            const valD = itemDefault ? itemDefault[key] : undefined;

            (finalItem as any)[key] = mergeProperties(key, valA, valB, valD);
        });

        return finalItem;
    });

    // 3. 处理 B 中的新增项 (B 中有，但 A 中没有的 ID)
    // 规则："B中新增的元素按照B中原有的顺序排列在A后面"
    const newItemsFromB = categoriesB.filter((itemB) => !idsInA.has(itemB.id));

    // 4. 合并结果
    return [...mergedList, ...newItemsFromB];
}
