import dayjs, { type Dayjs } from "dayjs";
import isSameOrAfter from "dayjs/plugin/isSameOrAfter";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { numberToAmount } from "./bill";

dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);

import { DefaultCurrencyId as DefaultBaseCurrencyId } from "@/api/currency/currencies";
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
