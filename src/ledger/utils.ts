import dayjs, { type Dayjs } from "dayjs";
import type { Bill, BillFilter, BillType } from "./type";

const isTypeMatched = (bill: Bill, type?: BillType) => {
    if (type === undefined) return true;
    return ['expense', 'income'].includes(bill.type);
};

export const isTimeMatched = (
    bill: Bill,
    _start?: Dayjs | string | number,
    _end?: Dayjs | string | number,
) => {
    const d = dayjs.unix(bill.time);
    const start = _start === undefined ? undefined : typeof _start === 'number' ? dayjs.unix(_start / 1000) : dayjs(_start)
    const end = _end === undefined ? undefined : typeof _end === 'number' ? dayjs.unix(_end / 1000) : dayjs(_end)
    if (start) {
        if (end) {
            return d.isAfter(start) && d.isBefore(end);
        }
        return d.isAfter(start);
    }
    if (end) {
        return d.isBefore(end);
    }
    return true;
};

const isMoneyMatched = (bill: Bill, _min = -Infinity, _max = Infinity) => {
    const [min, max] = _min < _max ? [_min, _max] : [_max, _min]
    return bill.amount <= max && bill.amount >= min;
};
const isUserMatched = (bill: Bill, uids?: (string | number)[]) => {
    return (uids && uids.length) ? uids.some((u) => bill.creatorId === u) : true;
};
const isCateMatched = (bill: Bill, cates?: string[]) => {
    return (cates && cates.length) ? cates.some((c) => bill.categoryId === c) : true;
};

const isCommentMatched = (bill: Bill, comment?: string) => {
    return comment ? Boolean(bill.comment?.includes(comment)) : true;
};
export const isBillMatched = (
    bill: Bill,
    filter: BillFilter,
) => {
    return (
        isTypeMatched(bill, filter.type) &&
        isUserMatched(bill, filter.creators) &&
        isCateMatched(bill, filter.categories) &&
        isMoneyMatched(bill, filter.minAmount, filter.maxAmount) &&
        isTimeMatched(bill, filter.start, filter.end) &&
        isCommentMatched(bill, filter.comment)
    );
};
