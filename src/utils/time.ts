import dayjs, { type Dayjs } from "dayjs";

export const formatTime = (t: number) =>
	dayjs.unix(t / 1000).format("YYYY-MM-DD HH:mm");

// import { currentLanguage, t } from "@/locale";

const t = (v: any) => v;

const currentLanguage = { id: "en" };

export const denseTime = (time: Dayjs) => {
	const now = dayjs();
	if (time.isSame(now, "days")) {
		return t("Today");
	}
	const dayDiff = time.diff(now, "day");
	if (dayDiff <= 3 && dayDiff >= 0) {
		if (currentLanguage?.id === "zh") return `${time.format("DD")}日`;
		return time.format("MM-DD");
	}
	if (time.isSame(now, "year")) {
		return time.format("MM-DD");
	}
	return time.format("YYYY-MM-DD");
};

export const shorTime = (t: number) => dayjs.unix(t / 1000).format("YY/MM/DD HH:mm");