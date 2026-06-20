import { createContext, type ReactNode, useCallback, useContext } from "react";
import type { ZenLocale } from "../runtime/types";
import en from "./en.json";
import zh from "./zh.json";

const messages = { zh, en } as const;
const LocaleContext = createContext<ZenLocale>("zh");

export function translate(
    locale: ZenLocale,
    key: string,
    values?: Record<string, unknown>,
) {
    let value = String(
        (messages[locale] as Record<string, unknown>)[key] ??
            (messages.zh as Record<string, unknown>)[key] ??
            key,
    );
    for (const [name, replacement] of Object.entries(values ?? {})) {
        value = value.replaceAll(`{${name}}`, String(replacement));
    }
    return value;
}

export function ZenI18nProvider({
    locale,
    children,
}: {
    locale: ZenLocale;
    children: ReactNode;
}) {
    return (
        <LocaleContext.Provider value={locale}>
            {children}
        </LocaleContext.Provider>
    );
}

export function useIntl() {
    const locale = useContext(LocaleContext);
    return useCallback(
        (key: string, values?: Record<string, unknown>) =>
            translate(locale, key, values),
        [locale],
    );
}

export function t(key: string, values?: Record<string, unknown>) {
    return translate("zh", key, values);
}
