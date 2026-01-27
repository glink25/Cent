import dayjs from "dayjs";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { useLocale } from "@/locale";
import { cn } from "@/utils";
import { collaboratorColors } from "@/utils/color";
import { toThousand } from "@/utils/number";
import type { EnvArg } from "../assistant/env";

export interface CalendarCellSlotProps {
    date: dayjs.Dayjs;
    isInRange: boolean;
    isToday: boolean;
    isCurrentPeriod?: boolean; // 对于月视图：是否在当前月；对于年视图：是否在当前年
}

export interface CalendarDetailProps
    extends Pick<EnvArg, "range" | "viewType"> {
    // 周视图和月视图的日期单元格slot
    daySlot?: (props: CalendarCellSlotProps) => ReactNode;
    // 年视图的月份单元格slot
    monthSlot?: (props: CalendarCellSlotProps) => ReactNode;
}

function BaseCalendarDetail({
    range,
    viewType,
    daySlot,
    monthSlot,
}: CalendarDetailProps) {
    const { locale } = useLocale();

    // 将语言代码映射到 Intl 格式 (zh -> zh-CN, en -> en-US)
    const intlLocale = locale === "zh" ? "zh-CN" : "en-US";

    // 生成本地化的星期名称
    const getWeekdayNames = useMemo(() => {
        const names: string[] = [];
        const formatter = new Intl.DateTimeFormat(intlLocale, {
            weekday: "short",
        });
        // 2024-01-07 是周日，作为基准日期
        const baseDate = new Date(2024, 0, 7);
        for (let i = 0; i < 7; i++) {
            const day = new Date(baseDate);
            day.setDate(baseDate.getDate() + i);
            const weekdayName = formatter.format(day);
            // 对于中文，提取最后一个字符（如"周日" -> "日"）
            // 对于英文，使用前两个字符（如"Sun" -> "Su"）
            if (locale === "zh") {
                names.push(weekdayName.slice(-1));
            } else {
                names.push(weekdayName.slice(0, 2));
            }
        }
        return names;
    }, [intlLocale, locale]);

    // 生成本地化的月份名称
    const getMonthNames = useMemo(() => {
        const names: string[] = [];
        for (let i = 0; i < 12; i++) {
            const date = new Date(2024, i, 1);
            if (locale === "zh") {
                // 中文格式：使用数字 + "月"
                const monthNumber = i + 1;
                names.push(`${monthNumber}月`);
            } else {
                // 英文格式：使用短月份名称
                const monthName = date.toLocaleDateString(intlLocale, {
                    month: "short",
                });
                names.push(monthName);
            }
        }
        return names;
    }, [intlLocale, locale]);

    // 将 range 转换为 dayjs 对象
    const startDate = useMemo(
        () => dayjs.unix((range?.[0] ?? Date.now()) / 1000),
        [range],
    );
    const endDate = useMemo(
        () => dayjs.unix((range?.[1] ?? Date.now()) / 1000),
        [range],
    );

    // 周视图：一行7列，周一到周日
    const weeklyDays = useMemo(() => {
        if (viewType !== "weekly") return [];
        // 获取 range 开始日期所在周的第一天（由 dayjs 默认起始日决定）
        const weekStart = startDate.startOf("week");
        const days = [];
        for (let i = 0; i < 7; i++) {
            days.push(weekStart.add(i, "day"));
        }
        return days;
    }, [viewType, startDate]);

    // 月视图：日历视图，显示该月的每一天
    const monthlyDays = useMemo(() => {
        if (viewType !== "monthly") return [];
        const monthStart = startDate.startOf("month");
        const monthEnd = startDate.endOf("month");
        const days = [];
        // 获取该月第一周的第一天（可能是上个月的日期）
        const firstDayOfWeek = monthStart.startOf("week");
        // 获取该月最后一周的最后一天（可能是下个月的日期）
        const lastDayOfWeek = monthEnd.endOf("week");
        let current = firstDayOfWeek;
        while (current.isSameOrBefore(lastDayOfWeek)) {
            days.push(current);
            current = current.add(1, "day");
        }
        return days;
    }, [viewType, startDate]);

    // 年视图：两行6列，显示每个月份
    const yearlyMonths = useMemo(() => {
        if (viewType !== "yearly") return [];
        const year = startDate.year();
        const months = [];
        for (let i = 0; i < 12; i++) {
            months.push(dayjs().year(year).month(i).startOf("month"));
        }
        return months;
    }, [viewType, startDate]);

    // 判断日期是否在 range 范围内
    const isInRange = (date: dayjs.Dayjs) => {
        return (
            date.isSameOrAfter(startDate, "day") &&
            date.isSameOrBefore(endDate, "day")
        );
    };

    // 判断日期是否是今天
    const isToday = (date: dayjs.Dayjs) => {
        return date.isSame(dayjs(), "day");
    };

    // 周视图渲染
    const renderWeeklyView = () => {
        const firstDay = weeklyDays[0];
        if (!firstDay) return null;

        return (
            <div className="w-full">
                <div className="grid grid-cols-7 gap-1">
                    {weeklyDays.map((day) => {
                        const weekdayIndex = day.day(); // 0=周日, 1=周一, ..., 6=周六
                        return (
                            <div
                                key={`weekday-${day.format("YYYY-MM-DD")}`}
                                className="text-center text-xs text-muted-foreground py-1"
                            >
                                {getWeekdayNames[weekdayIndex]}
                            </div>
                        );
                    })}
                </div>
                <div className="grid grid-cols-7 gap-1 mt-1">
                    {weeklyDays.map((day) => {
                        const inRange = isInRange(day);
                        const today = isToday(day);
                        const isCurrentMonth = day.isSame(startDate, "month");
                        return (
                            <div
                                key={day.format("YYYY-MM-DD")}
                                className={cn(
                                    "aspect-square flex flex-col items-center justify-center text-sm rounded-md relative",
                                    today &&
                                        !inRange &&
                                        isCurrentMonth &&
                                        "bg-accent text-accent-foreground",
                                )}
                            >
                                <span className="text-sm font-medium">
                                    {day.date()}
                                </span>
                                {daySlot?.({
                                    date: day,
                                    isInRange: inRange,
                                    isToday: today,
                                    isCurrentPeriod: isCurrentMonth,
                                })}
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    };

    // 月视图渲染
    const renderMonthlyView = () => {
        if (monthlyDays.length === 0) return null;
        // 根据 monthlyDays 中的第一周日期动态生成星期标签
        const firstWeek = monthlyDays.slice(0, 7);
        const weeks: dayjs.Dayjs[][] = [];
        for (let i = 0; i < monthlyDays.length; i += 7) {
            weeks.push(monthlyDays.slice(i, i + 7));
        }

        return (
            <div className="w-full">
                <div className="grid grid-cols-7 gap-1">
                    {firstWeek.map((day) => {
                        const weekdayIndex = day.day(); // 0=周日, 1=周一, ..., 6=周六
                        return (
                            <div
                                key={`weekday-${day.format("YYYY-MM-DD")}`}
                                className="text-center text-xs text-muted-foreground py-1"
                            >
                                {getWeekdayNames[weekdayIndex]}
                            </div>
                        );
                    })}
                </div>
                {weeks.map((week) => (
                    <div
                        key={week[0]?.format("YYYY-MM-DD")}
                        className="grid grid-cols-7 gap-1 mt-1"
                    >
                        {week.map((day) => {
                            const isCurrentMonth = day.isSame(
                                startDate,
                                "month",
                            );
                            const inRange = isInRange(day);
                            const today = isToday(day);
                            return (
                                <div
                                    key={day.format("YYYY-MM-DD")}
                                    data-in-range={isCurrentMonth}
                                    className={cn(
                                        "aspect-square flex flex-col items-center justify-center text-sm rounded-md relative",
                                        today &&
                                            "bg-accent text-accent-foreground",
                                        !isCurrentMonth && "opacity-40",
                                    )}
                                >
                                    <span className="text-sm font-medium">
                                        {day.date()}
                                    </span>
                                    {daySlot?.({
                                        date: day,
                                        isInRange: inRange,
                                        isToday: today,
                                        isCurrentPeriod: isCurrentMonth,
                                    })}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    // 年视图渲染
    const renderYearlyView = () => {
        const rows: dayjs.Dayjs[][] = [];
        for (let i = 0; i < yearlyMonths.length; i += 6) {
            rows.push(yearlyMonths.slice(i, i + 6));
        }
        const currentYear = dayjs().year();

        return (
            <div className="w-full">
                {rows.map((row) => (
                    <div
                        key={row[0]?.format("YYYY-MM")}
                        className="grid grid-cols-6 gap-1 mb-1"
                    >
                        {row.map((month) => {
                            const monthIndexInYear = month.month();
                            const inRange =
                                month.isSameOrAfter(
                                    startDate.startOf("month"),
                                    "month",
                                ) &&
                                month.isSameOrBefore(
                                    endDate.startOf("month"),
                                    "month",
                                );
                            const isCurrentMonth = month.isSame(
                                dayjs(),
                                "month",
                            );
                            const isCurrentYear = month.year() === currentYear;
                            return (
                                <div
                                    key={month.format("YYYY-MM")}
                                    className={cn(
                                        "aspect-square flex flex-col items-center justify-center text-sm rounded-md relative",
                                        isCurrentMonth &&
                                            isCurrentYear &&
                                            "bg-accent text-accent-foreground",
                                    )}
                                >
                                    <span className="text-xs font-medium">
                                        {getMonthNames[monthIndexInYear]}
                                    </span>
                                    {monthSlot?.({
                                        date: month,
                                        isInRange: inRange,
                                        isToday: isCurrentMonth,
                                        isCurrentPeriod: isCurrentYear,
                                    })}
                                </div>
                            );
                        })}
                    </div>
                ))}
            </div>
        );
    };

    if (!viewType || !range || range.length !== 2) {
        return null;
    }

    return (
        <div className="p-4">
            {viewType === "weekly" && renderWeeklyView()}
            {viewType === "monthly" && renderMonthlyView()}
            {viewType === "yearly" && renderYearlyView()}
        </div>
    );
}

// dataset 可能的值为
// 1.dimension === category 时
// const dataset = { source: [
//     ["date", "收入", "支出", "结余"],
//     ['2026-01-11', 0, 180.9, -180.9],
//     ['2026-01-12', 0, 168.4, -349.3],
//     ['2026-01-13', 0, 246.2, -595.5]
// ] };
// 2. dimension === user 时
// const dataset = { source: [
//     ['date', 'Me','others'],
//     ['2026-01-11', 100,200],
//     ['2026-01-12', 203,403],
//     ['2026-01-13', 400,205]
// ] };
// 根据dataset，在每个日历视图的元素中展示具体的数值，
// 例如对于第一种情况，在1-11这一天的日历元素下方展示三行，分别是 +0 -180 -180.9
// 对于第二种情况，在1-11这一天的日历元素展示下面两行，分别是+100 +200
// 注意要展示多少行是根据dataset的具体内容来决定的

interface DatasetSource {
    source?: (string | number)[][];
}

export default function CalendarDetail({
    dataset,
    dimension,
    ...props
}: {
    dataset: DatasetSource;
    dimension: "category" | "user";
} & CalendarDetailProps) {
    // 解析 dataset，创建日期到数据的映射
    const dateDataMap = useMemo(() => {
        const map = new Map<string, number[]>();
        if (!dataset?.source || !Array.isArray(dataset.source)) {
            return map;
        }

        const source = dataset.source;
        if (source.length === 0) {
            return map;
        }

        // 第一行是表头，从第二行开始是数据
        for (let i = 1; i < source.length; i++) {
            const row = source[i];
            if (!Array.isArray(row) || row.length === 0) {
                continue;
            }

            const dateStr = String(row[0]);
            // 提取数据列（跳过第一列日期）
            const dataValues = row.slice(1).map((val) => Number(val) || 0);
            map.set(dateStr, dataValues);
        }

        return map;
    }, [dataset]);

    // 获取指定日期的数据
    const getDateData = (date: dayjs.Dayjs) => {
        const dateStr = date.format("YYYY-MM-DD");
        return dateDataMap.get(dateStr) || [];
    };

    // 获取指定月份的数据（用于年视图）
    const getMonthData = (month: dayjs.Dayjs) => {
        // 查找该月份第一天的数据
        const firstDayOfMonth = month.startOf("month");
        const dateStr = firstDayOfMonth.format("YYYY-MM-DD");
        return dateDataMap.get(dateStr) || [];
    };

    // 获取列名（表头，跳过第一列日期）
    const columnNames = useMemo(() => {
        if (
            !dataset?.source ||
            !Array.isArray(dataset.source) ||
            dataset.source.length === 0
        ) {
            return [];
        }
        const header = dataset.source[0];
        if (!Array.isArray(header)) {
            return [];
        }
        return header.slice(1).map((name) => String(name)); // 跳过第一列日期
    }, [dataset]);

    // 格式化数值显示
    const formatValue = (
        value: number,
        index: number /**第几列数据 */,
        data: number[],
    ) => {
        const m = (v: number) => {
            const v1 = toThousand(v, 0, 2);
            if (v1.length > 6) {
                return toThousand(v, 0, 0);
            }
            return v1;
        };

        if (dimension === "category") {
            // category 维度：显示正负号
            if (index === 0) {
                return <div className="text-semantic-income">+{m(value)}</div>;
            }
            if (index === 1) {
                return (
                    <div className="text-semantic-expense">
                        -{m(Math.abs(value))}
                    </div>
                );
            }
            const balance = data[0] - data[1];
            return `${balance >= 0 ? "+" : "-"}${m(Math.abs(balance))}`;
        } else {
            // user 维度：显示加号
            const userName = dataset.source?.[0]?.[index + 1];
            return (
                <div style={{ color: collaboratorColors(`${userName}`) }}>
                    {value}
                </div>
            );
        }
    };

    // 渲染日期单元格的数据
    const renderDaySlot = (props: CalendarCellSlotProps) => {
        const data = getDateData(props.date);
        if (data.length === 0) {
            return <div className="h-full"></div>;
        }

        const dateKey = props.date.format("YYYY-MM-DD");
        return (
            <div className="p-0.5 space-y-0.5 max-w-full">
                {data.map((value, index) => {
                    const columnName = columnNames[index] ?? `col-${index}`;
                    return (
                        <div
                            key={`${dateKey}-${columnName}`}
                            className="text-[8px] sm:text-[10px] leading-tight text-center truncate"
                        >
                            {formatValue(value, index, data)}
                        </div>
                    );
                })}
            </div>
        );
    };

    // 渲染月份单元格的数据（年视图）
    const renderMonthSlot = (props: CalendarCellSlotProps) => {
        const data = getMonthData(props.date);
        if (data.length === 0) {
            return <div className="h-full"></div>;
        }
        const monthKey = props.date.format("YYYY-MM");
        return (
            <div className="p-0.5 space-y-0.5 max-w-full">
                {data.map((value, index) => {
                    const columnName = columnNames[index] ?? `col-${index}`;
                    return (
                        <div
                            key={`${monthKey}-${columnName}`}
                            className="text-[8px] sm:text-[10px] leading-tight text-center truncate"
                        >
                            {formatValue(value, index, data)}
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <BaseCalendarDetail
            {...props}
            daySlot={(slotProps) => <>{renderDaySlot(slotProps)}</>}
            monthSlot={(slotProps) => <>{renderMonthSlot(slotProps)}</>}
        />
    );
}
