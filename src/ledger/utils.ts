import dayjs, { type Dayjs } from "dayjs";
import { numberToAmount } from "./bill";
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
			return d.isAfter(start) && d.isBefore(end);
		}
		return d.isAfter(start);
	}
	if (end) {
		return d.isBefore(end);
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
	return uids && uids.length ? uids.some((u) => bill.creatorId === u) : true;
};
const isCateMatched = (bill: Bill, cates?: string[]) => {
	return cates && cates.length
		? cates.some((c) => bill.categoryId === c)
		: true;
};

const isCommentMatched = (bill: Bill, comment?: string) => {
	return comment ? Boolean(bill.comment?.includes(comment)) : true;
};

const isAssetsMatched = (bill: Bill, assets?: boolean) => {
	return assets === true ? Boolean(bill.image) : true;
};

export const isBillMatched = (bill: Bill, filter: BillFilter) => {
	return (
		isTypeMatched(bill, filter.type) &&
		isUserMatched(bill, filter.creators) &&
		isCateMatched(bill, filter.categories) &&
		isMoneyMatched(bill, filter.minAmountNumber, filter.maxAmountNumber) &&
		isTimeMatched(bill, filter.start, filter.end, filter.recent) &&
		isAssetsMatched(bill, filter.assets) &&
		isCommentMatched(bill, filter.comment)
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

export const intlCategory = <T extends BillCategory | undefined>(c: T, t: any): T => {
	if (c === undefined) {
		return c
	}
	return { ...c, name: c.custom ? c.name : t(c.name) };
};