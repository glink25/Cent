import dayjs from "dayjs";
import { useCallback } from "react";
import { v4 } from "uuid";
import { useShallow } from "zustand/shallow";
import type { Scheduled } from "@/components/scheduled/type";
import type { Bill } from "@/ledger/type";
import { useBookStore } from "@/store/book";
import { type EditBill, useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";

export function useScheduled() {
    const [scheduleds = []] = useLedgerStore(
        useShallow((state) => {
            const userId = useUserStore.getState().id;
            const scheduleds = state.infos?.meta.personal?.[userId]?.scheduleds;
            return [scheduleds];
        }),
    );

    const add = useCallback(
        async (s: Omit<Scheduled, "id"> & { id?: string }) => {
            const book = useBookStore.getState().currentBookId;
            if (!book) return;
            await useLedgerStore.getState().updatePersonalMeta((prev) => {
                if (prev.scheduleds === undefined) {
                    prev.scheduleds = [];
                }
                prev.scheduleds.push({ ...s, id: s.id ?? v4() });
                return prev;
            });
            return s.id;
        },
        [],
    );

    const update = useCallback(
        async (id: string, value?: Omit<Scheduled, "id">) => {
            const book = useBookStore.getState().currentBookId;
            if (!book) return;
            await useLedgerStore.getState().updatePersonalMeta((prev) => {
                if (prev.scheduleds === undefined) return prev;
                if (value === undefined) {
                    prev.scheduleds = prev.scheduleds.filter(
                        (v) => v.id !== id,
                    );
                    return prev;
                }
                const index = prev.scheduleds.findIndex((v) => v.id === id);
                if (index === -1) return prev;
                prev.scheduleds[index] = {
                    id,
                    ...value,
                };
                return prev;
            });
        },
        [],
    );

    const applyScheduled = useCallback(() => {
        const valids = scheduleds.filter((v) => v.enabled);
        return valids.map(async (scheduled) => {
            const needBills = await fillScheduledBills(scheduled);
            if (needBills.length > 0) {
                update(scheduled.id, {
                    ...scheduled,
                    latest: Date.now() + 1,
                });
                useLedgerStore.getState().addBills(needBills);
            }
        });
    }, [scheduleds, update]);

    return { scheduleds, add, update, applyScheduled };
}

/**
 * 计算在指定时间范围内，基于基准日期的重复发生次数及具体时间点
 * @param repeatValue 重复频率数值
 * @param repeatUnit 重复单位 (周/日/月/年)
 * @param start 基准日期的时间戳（决定了具体的重复点，如每月的“3号”）
 * @param from 统计起始范围
 * @param to 统计结束范围，默认为当前时间
 */
function calcDates(
    repeatValue: number,
    repeatUnit: "week" | "day" | "month" | "year",
    start: number,
    from: number,
    to = Date.now(),
) {
    const results: number[] = [];
    const startDate = dayjs.unix(start / 1000);
    const fromDate = dayjs.unix(from / 1000);
    const toDate = dayjs.unix(to / 1000);

    // 1. 寻找第一个可能的发生点
    // 我们从 start 开始，根据 repeat 步长不断增加，直到它 >= from
    let currentOccurrence = startDate;

    // 如果基准点早于开始统计的时间，我们需要“跳过”前面不符合条件的周期
    // 注意：这里为了严谨，直接循环累加是最能保证 month/year 逻辑准确的方式
    while (currentOccurrence.isBefore(fromDate)) {
        currentOccurrence = currentOccurrence.add(repeatValue, repeatUnit);
    }

    // 2. 收集所有在 [from, to] 范围内的日期
    // 注意：isBefore 和 isAfter 是不包含边界的，所以这里用 !isAfter 模拟 <=
    while (!currentOccurrence.isAfter(toDate)) {
        // 确保它不在 from 之前（应对 start 本身就在 from 之后的情况）
        if (!currentOccurrence.isBefore(fromDate)) {
            results.push(currentOccurrence.valueOf());
        }
        currentOccurrence = currentOccurrence.add(repeatValue, repeatUnit);
    }

    return results;
}

export async function fillScheduledBills(scheduled: Scheduled) {
    const allBills = await useLedgerStore.getState().refreshBillList();
    const existed: Bill[] = [];
    // 过滤出已经自动记录过的周期账单
    for (let index = 0; index < allBills.length; index += 1) {
        const bill = allBills[index];
        if (scheduled.end && bill.time > scheduled.end) {
            continue;
        }
        if (bill.time < scheduled.start) {
            break;
        }
        if (bill.extra?.scheduledId === scheduled.id) {
            existed.push(bill);
        }
    }

    const allDates = calcDates(
        scheduled.repeat.value,
        scheduled.repeat.unit,
        scheduled.start,
        scheduled.latest ?? scheduled.start,
        scheduled.end,
    );

    const diff = allDates.filter((time) => {
        const date = dayjs.unix(time / 1000);
        return existed.every((bill) => {
            const billDate = dayjs.unix(bill.time / 1000);
            return !date.isSame(billDate, "date");
        });
    });

    return diff.map((time) => {
        const { type, categoryId, amount, comment, currency, tagIds, extra } =
            scheduled.template;
        return {
            type,
            categoryId,
            amount,
            comment,
            currency,
            tagIds,
            time,
            extra: {
                ...extra,
                scheduledId: scheduled.id,
            },
        } as EditBill;
    });
}

/**
 * 计算给定时间 time 之后的下一个重复日期
 * @param repeatValue 重复频率数值
 * @param repeatUnit 重复单位
 * @param time 当前参考时间（以此时间为基数找“下一个”）
 * @param from 基准日期时间戳（决定了重复的具体规则，如“每月5号”）
 * @param to 截止时间，如果超过此时间则返回 undefined
 */
export function calcNextDate(
    repeatValue: number,
    repeatUnit: "week" | "day" | "month" | "year",
    time: number,
    from: number,
    to?: number,
): number | undefined {
    const referenceStart = dayjs(from);
    const currentTime = dayjs(time);

    let nextOccurrence = referenceStart;

    // 1. 如果基准点就在 time 之后，那么第一个符合条件的日期就是基准点本身
    // 2. 如果基准点在 time 之前，则需要不断累加步长，直到跳出当前 time
    if (
        nextOccurrence.isBefore(currentTime) ||
        nextOccurrence.isSame(currentTime)
    ) {
        // 优化：计算大概需要跳过多少个周期，减少循环次数（可选）
        // 这里采用标准 add 逻辑以保证 month/year 的月份溢出处理正确
        while (!nextOccurrence.isAfter(currentTime)) {
            nextOccurrence = nextOccurrence.add(repeatValue, repeatUnit);
        }
    }

    // 检查是否超过了截止时间
    if (to && nextOccurrence.isAfter(dayjs(to))) {
        return undefined;
    }

    return nextOccurrence.valueOf();
}
