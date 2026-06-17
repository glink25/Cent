import dayjs from "dayjs";
import type {
    ZenCalendarPosition,
    ZenDayId,
    ZenPeriod,
    ZenPost,
    ZenSuggestedPeriod,
} from "./types";

export function getZenDayId(now = dayjs()): ZenDayId {
    return now.format("YYYY-MM-DD");
}

export function getDailyZenPeriod(now = dayjs()): ZenPeriod {
    return {
        type: "daily",
        start: now.startOf("day").valueOf(),
        end: now.endOf("day").valueOf(),
    };
}

export function getCalendarPosition(now = dayjs()): ZenCalendarPosition {
    const day = now.date();
    const daysInMonth = now.daysInMonth();
    if (day <= 7) return "month_start";
    if (day >= daysInMonth - 6) return "month_end";
    return "month_middle";
}

export function getDefaultZenPeriod({
    now = dayjs(),
    lastZenPost,
}: {
    now?: dayjs.Dayjs;
    lastZenPost?: ZenPost;
}): ZenPeriod {
    if (lastZenPost) {
        return {
            type: "custom",
            start: Math.min(lastZenPost.completedAt + 1, now.valueOf()),
            end: now.endOf("day").valueOf(),
        };
    }
    return {
        type: "weekly",
        start: now.subtract(6, "day").startOf("day").valueOf(),
        end: now.endOf("day").valueOf(),
    };
}

export function getSuggestedZenPeriods({
    now = dayjs(),
    lastZenPost,
}: {
    now?: dayjs.Dayjs;
    lastZenPost?: ZenPost;
}): ZenSuggestedPeriod[] {
    const periods: ZenSuggestedPeriod[] = [];
    if (lastZenPost) {
        periods.push({
            id: "since-last-zen",
            label: "上次 Zen 后至今",
            period: getDefaultZenPeriod({ now, lastZenPost }),
            reason: "适合延续上一次复盘后的变化。",
        });
    }
    periods.push(
        {
            id: "recent-7-days",
            label: "最近 7 天",
            period: {
                type: "weekly",
                start: now.subtract(6, "day").startOf("day").valueOf(),
                end: now.endOf("day").valueOf(),
            },
            reason: "适合做轻量近期回顾。",
        },
        {
            id: "month-to-date",
            label: "本月以来",
            period: {
                type: "monthly",
                start: now.startOf("month").valueOf(),
                end: now.endOf("day").valueOf(),
            },
            reason: "适合观察本月节奏和趋势。",
        },
        {
            id: "previous-month",
            label: "上个月",
            period: {
                type: "monthly",
                start: now.subtract(1, "month").startOf("month").valueOf(),
                end: now.subtract(1, "month").endOf("month").valueOf(),
            },
            reason: "适合月初回看刚结束的完整月份。",
        },
    );
    return periods;
}

export function getZenSessionKey({
    bookId,
    userId,
    zenDayId,
}: {
    bookId: string;
    userId: string | number;
    zenDayId: ZenDayId;
}) {
    return `${bookId}:${userId}:${zenDayId}`;
}
