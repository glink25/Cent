import React, { type ReactNode, useCallback, useEffect, useState } from "react";
import {
	createIntl,
	createIntlCache,
	IntlProvider,
	type IntlShape,
	useIntl as useOriginalIntl,
} from "react-intl";
import { usePreference } from "@/store/preference";
import { type LocaleName, locales } from "./utils";

// 在外部使用的 Intl 实例
export let intl: IntlShape;

const cache = createIntlCache();

// 异步加载语言包并初始化全局 Intl 实例
export async function initIntl(locale: LocaleName) {
	const currentLocale = locales.find((l) => l.name === locale);
	if (!currentLocale) {
		console.error(`Locale ${locale} not supported.`);
		return;
	}

	try {
		const messages = await currentLocale.fetcher();
		intl = createIntl(
			{
				locale: currentLocale.name,
				messages: messages.default,
			},
			cache,
		);
	} catch (error) {
		console.error(
			`Failed to load locale messages for ${currentLocale.name}:`,
			error,
		);
	}
}
// 管理语言状态并暴露切换语言的方法
interface LocaleContextValue {
	locale: LocaleName;
	setLocale: (newLocale: LocaleName) => void;
}

const LocaleContext = React.createContext<LocaleContextValue | undefined>(
	undefined,
);

// 自定义 hook，方便在组件中获取语言状态和切换方法
export const useLocale = () => {
	const context = React.useContext(LocaleContext);
	if (context === undefined) {
		throw new Error("useLocale must be used within a LocaleProvider");
	}
	return context;
};

export function LocaleProvider({ children }: { children: ReactNode }) {
	const [locale, setLocale] = usePreference("locale");
	const [messages, setMessages] = useState<Record<string, string>>({});
	const [isReady, setIsReady] = useState(false);

	// 语言切换函数，负责懒加载语言包并更新状态
	const switchLanguage = useCallback(
		async (newLocale: LocaleName) => {
			try {
				const currentLocale = locales.find((l) => l.name === newLocale);
				if (currentLocale) {
					const langModule = await currentLocale.fetcher();
					setMessages(langModule.default);
					setLocale(newLocale);
				}
			} catch (error) {
				console.error("Failed to load language:", error);
			}
		},
		[setLocale],
	);

	useEffect(() => {
		// 初始加载浏览器语言对应的语言包
		const loadInitialLang = async () => {
			await switchLanguage(locale);
			setIsReady(true);
		};
		loadInitialLang();
	}, [locale, switchLanguage]);

	// 如果语言包还没有加载好，可以显示一个加载状态
	if (!isReady) {
		return <div>Loading language...</div>;
	}

	return (
		<LocaleContext.Provider value={{ locale, setLocale: switchLanguage }}>
			<IntlProvider locale={locale} messages={messages}>
				{children}
			</IntlProvider>
		</LocaleContext.Provider>
	);
}

export function useIntl() {
	const { $t } = useOriginalIntl();
	return useCallback(
		(key: string, p?: Record<string, any>) => $t({ id: key }, p),
		[$t],
	);
}

export const t = (key: string, p?: Record<string, any>) => {
	if (!intl) {
		console.warn("intl not initialized");
		return key;
	}
	return intl.formatMessage({ id: key }, p);
};
