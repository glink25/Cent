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

/**
 * ZenPost 的归属日由规范 ID 决定。旧版本曾误把 period.start 写入 time，
 * 因此读取时优先从 ID 恢复日期，并为非规范旧数据保留 time 回退。
 */
export function getZenPostDayId(post: Pick<ZenPost, "id" | "time">): ZenDayId {
    return (
        /^zen-(\d{4}-\d{2}-\d{2})-/.exec(post.id)?.[1] ??
        dayjs(post.time).format("YYYY-MM-DD")
    );
}

export function isZenEntranceOpen(
    scheduledTime = "21:00",
    now = dayjs(),
): boolean {
    const match = /^(\d{1,2}):(\d{2})$/.exec(scheduledTime);
    const hour = Number(match?.[1]);
    const minute = Number(match?.[2]);
    const valid =
        match &&
        Number.isInteger(hour) &&
        Number.isInteger(minute) &&
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59;
    const open = valid
        ? now.startOf("day").hour(hour).minute(minute).second(0).millisecond(0)
        : now.startOf("day").hour(21).minute(0).second(0).millisecond(0);
    return now.valueOf() >= open.valueOf();
}

/**
 * 可用的 Zen 预设风格名（语义化），与 zen.css / themes/*.css 中的
 * .zen-style-{name} 选择器一一对应；数组顺序即每日轮换顺序。
 * `default` 直接沿用 zen.css 基线 token，无独立选择器。
 */
export const ZEN_STYLE_NAMES = [
    "default",
    "aurora",
    "beach",
    "red-moon",
    "rain",
    "star-night",
] as const;

export type ZenStyleName = (typeof ZEN_STYLE_NAMES)[number];

/**
 * 按日期计算出一个稳定的预设风格序号（当天不变，逐日轮换）。
 * 使用 day-of-year 取模，避免引入 dayjs dayOfYear 插件。
 */
export function getZenStyleIndex(
    now = dayjs(),
    count = ZEN_STYLE_NAMES.length,
): number {
    const dayOfYear = now.diff(now.startOf("year"), "day");
    return ((dayOfYear % count) + count) % count;
}

/** 当天对应的语义化风格名，用于拼出 `zen-style-{name}` 类。 */
export function getZenStyleName(now = dayjs()): ZenStyleName {
    return ZEN_STYLE_NAMES[getZenStyleIndex(now)];
}

/** Prefer a valid host override, otherwise keep the date-based rotation. */
export function resolveZenStyleName(
    style?: string | null,
    now = dayjs(),
): ZenStyleName {
    return ZEN_STYLE_NAMES.includes(style as ZenStyleName)
        ? (style as ZenStyleName)
        : getZenStyleName(now);
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
