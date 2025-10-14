import dayjs from "dayjs";
import { orderBy } from "lodash-es";
import { toDayjs } from "./time";

// 如果传入的列表有序，则可以使用此函数减少遍历次数，默认最新的在第一位
export const filterOrderedBillListByTimeRange = <T extends { time: number }>(
    orderedList: T[],
    range: [number | dayjs.Dayjs, number | dayjs.Dayjs],
    desc = true,
) => {
    const [oldest, newest] = orderBy(range.map(toDayjs), (v) => v.unix());

    const result: typeof orderedList = [];
    for (let index = 0; index < orderedList.length; index++) {
        const bill = orderedList[desc ? index : orderedList.length - index];
        const billTime = dayjs.unix(bill.time / 1000);
        if (billTime.isAfter(newest)) {
        } else if (billTime.isAfter(oldest)) {
            result.push(bill);
        } else if (billTime.isBefore(oldest)) {
            break;
        }
    }
    return result;
};
