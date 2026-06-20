import {
    createContext,
    type ReactNode,
    useContext,
    useEffect,
    useMemo,
} from "react";
import en from "./locales/en.json";
import zh from "./locales/zh.json";

export type Locale = "zh" | "en";

type Messages = typeof en;
type MessageKey = keyof Messages;

const dictionaries: Record<Locale, Messages> = {
    en,
    zh,
};

const I18nContext = createContext<{
    locale: Locale;
    t: (key: MessageKey) => string;
} | null>(null);

export function resolveLocale(locale?: Locale): Locale {
    if (locale) {
        return locale;
    }
    const browserLocale = globalThis.navigator?.language.toLowerCase() ?? "";
    return browserLocale.startsWith("zh") ? "zh" : "en";
}

export function I18nProvider({
    children,
    locale,
}: {
    children?: ReactNode;
    locale?: Locale;
}) {
    const resolvedLocale = resolveLocale(locale);

    useEffect(() => {
        document.documentElement.lang = resolvedLocale;
    }, [resolvedLocale]);

    const value = useMemo(
        () => ({
            locale: resolvedLocale,
            t: (key: MessageKey) =>
                dictionaries[resolvedLocale][key] ?? dictionaries.en[key],
        }),
        [resolvedLocale],
    );

    return (
        <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
    );
}

export function useI18n() {
    const ctx = useContext(I18nContext);
    if (!ctx) {
        throw new Error("I18nContext init failed");
    }
    return ctx;
}
