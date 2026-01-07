import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import { orderBy } from "lodash-es";

dayjs.extend(isBetween);

/**
 * 边界配置：'(' 表示开，'[' 表示闭
 * 例如: '[]' 为全闭区间, '[)' 为左闭右开
 */
type IntervalType = "[]" | "()" | "[)" | "(]";

interface FilterOptions<T> {
    range: [number | dayjs.Dayjs | undefined, number | dayjs.Dayjs | undefined];
    interval?: IntervalType; // 默认 '[)'
    desc?: boolean; // 传入的列表是否为降序，默认 true
    customFilter?: (item: T) => boolean; // 额外的过滤条件
}
export const filterOrderedBillListByTimeRangeAnd = <T extends { time: number }>(
    orderedList: T[],
    options: FilterOptions<T>,
): T[] => {
    const { range, interval = "[)", desc = true, customFilter } = options;

    // 1. 处理边界：过滤掉空值并排序
    const validRange = range.map((v) => (v ? dayjs(v) : null));
    const [r1, r2] = validRange;

    // 确定 oldest 和 newest
    let oldest: dayjs.Dayjs | null = null;
    let newest: dayjs.Dayjs | null = null;

    if (r1 && r2) {
        [oldest, newest] = r1.isBefore(r2) ? [r1, r2] : [r2, r1];
    } else {
        // 如果只有一个边界，或者没有边界
        oldest = r1 || r2 || null;
        // 注意：这种简单处理适用于“单边”情况，下面通过逻辑判断谁是上限谁是下限
    }

    const result: T[] = [];

    for (const item of orderedList) {
        const itemTime = dayjs.unix(item.time / 1000);

        // 2. 时间过滤逻辑（核心修改）
        let isInTimeRange = true;

        if (r1 && r2) {
            // 双边都有值，使用 isBetween
            isInTimeRange = itemTime.isBetween(oldest, newest, null, interval);
        } else if (r1 || r2) {
            // 单边情况：根据 interval 的第一个符号决定是否包含边界
            const limit = (r1 || r2)!;
            const isInclude = interval.startsWith("[");

            // 这里我们假设 range[0] 是起点，range[1] 是终点（符合直觉）
            if (range[0]) {
                // 只有起点：itemTime >= range[0]
                isInTimeRange = isInclude
                    ? itemTime.isSameOrAfter(limit)
                    : itemTime.isAfter(limit);
            } else {
                // 只有终点：itemTime <= range[1]
                const isEndInclude = interval.endsWith("]");
                isInTimeRange = isEndInclude
                    ? itemTime.isSameOrBefore(limit)
                    : itemTime.isBefore(limit);
            }
        }

        // 3. 组合过滤
        if (isInTimeRange && (!customFilter || customFilter(item))) {
            result.push(item);
        }

        // 4. 提前中断优化
        if (desc && r1 && itemTime.isBefore(oldest)) break;
        if (!desc && r2 && itemTime.isAfter(newest)) break;
    }

    return result;
};

// 如果传入的列表有序，则可以使用此函数减少遍历次数，默认最新的在第一位
export const filterOrderedBillListByTimeRange = <T extends { time: number }>(
    orderedList: T[],
    range: [number | dayjs.Dayjs, number | dayjs.Dayjs],
    desc = true,
) => {
    return filterOrderedBillListByTimeRangeAnd(orderedList, { range, desc });
};
