export type LocaleName = "zh" | "en";

export const locales = [
	{
		name: "zh",
		fetcher: () => import("./lang/zh.json"),
		matcher: (_l: string) => _l.includes("zh-CN"),
		label: "中文-简体",
	},
	{
		name: "en",
		fetcher: () => import("./lang/en.json"),
		matcher: (_l: string) => true,
		label: "English",
	},
] as const;

export const getBrowserLang = (): LocaleName => {
	const browserLang: string =
		navigator.language || (navigator as any).browserLanguage;
	const locale = locales.find((l) => l.matcher(browserLang));
	return (locale?.name ?? locales[0].name) as LocaleName;
};
