import dayjs, { type Dayjs, type OpUnitType } from "dayjs";
import duration from "dayjs/plugin/duration";
import isBetween from "dayjs/plugin/isBetween";
import isSameOrBefore from "dayjs/plugin/isSameOrBefore";
import { intl, t } from "@/locale";

dayjs.extend(isBetween);
dayjs.extend(isSameOrBefore);
dayjs.extend(duration);

export const formatTime = (t: number) =>
	dayjs.unix(t / 1000).format("YYYY-MM-DD HH:mm");

/**
 * 格式化日期为 YYYY-MM-DD
 * @param timestamp 时间戳
 * @param gap 最小时间单位
 * @returns 格式化后的日期字符串
 */
export function formatDate(timestamp: number, gap: OpUnitType = "day"): string {
	const date = dayjs.unix(timestamp / 1000).startOf(gap);
	return date.format("YYYY-MM-DD");
	// const date = new Date(timestamp);
	// const year = date.getFullYear();
	// const month = (date.getMonth() + 1).toString().padStart(2, "0");
	// const day = date.getDate().toString().padStart(2, "0");
	// return `${year}-${month}-${day}`;
}

export const denseDate = (time: Dayjs, joiner = "-") => {
	const now = dayjs();
	if (time.isSame(now, "days")) {
		return t("Today");
	}
	const dayDiff = Math.abs(time.diff(now, "day"));
	if (dayDiff <= 3 && time.isSame(now, "M")) {
		if (intl.locale === "zh") return `${time.format("DD")}日`;
		return time.format(`MM${joiner}DD`);
	}
	if (time.isSame(now, "year")) {
		return time.format(`MM${joiner}DD`);
	}
	return time.format(`YYYY${joiner}MM${joiner}DD`);
};

export const denseTime = (_time: Dayjs | number) => {
	const now = dayjs();
	const time =
		typeof _time === "number" ? dayjs.unix(_time / 1000) : dayjs(_time);
	if (time.isSame(now, "days")) {
		return time.format("HH:mm");
	}
	const dayDiff = Math.abs(time.diff(now, "day"));
	if (dayDiff <= 3 && time.isSame(now, "M")) {
		if (intl.locale === "zh")
			return `${time.format("DD")}日 ${time.format("HH:mm")}`;
		return time.format("MM/DD HH:mm");
	}
	if (time.isSame(now, "year")) {
		return time.format("MM/DD HH:mm");
	}
	return time.format("YY/MM/DD HH:mm");
};

export const shortTime = (t: number) =>
	dayjs.unix(t / 1000).format("YY/MM/DD HH:mm");

export const toDayjs = (v: number | dayjs.Dayjs | Date) => {
	if (typeof v === "number") {
		return dayjs.unix(v / 1000);
	}
	return dayjs(v);
};
