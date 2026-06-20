import type React from "react";
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useState,
} from "react";

export type Theme = "light" | "dark" | "system";
const STORAGE_KEY = "theme";

type ThemeContextValue = {
    theme: Theme;
    setTheme: (t: Theme) => void;
    toggle: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyThemeClass(theme: Theme) {
    const el = document.documentElement;
    if (!el) return;
    if (theme === "dark") {
        el.classList.add("dark");
    } else if (theme === "light") {
        el.classList.remove("dark");
    } else {
        // system
        const prefersDark =
            window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
        if (prefersDark) el.classList.add("dark");
        else el.classList.remove("dark");
    }
}

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [theme, setThemeState] = useState<Theme>(() => {
        try {
            const s = localStorage.getItem(STORAGE_KEY) as Theme | null;
            return (s ?? "system") as Theme;
        } catch {
            return "system";
        }
    });

    // apply class initially and when theme changes
    useEffect(() => {
        applyThemeClass(theme);

        if (
            theme === "system" &&
            typeof window !== "undefined" &&
            window.matchMedia
        ) {
            const mq = window.matchMedia("(prefers-color-scheme: dark)");
            const handler = () => applyThemeClass("system");

            if (mq.addEventListener) mq.addEventListener("change", handler);
            else if ((mq as any).addListener) (mq as any).addListener(handler);

            return () => {
                if (mq.removeEventListener)
                    mq.removeEventListener("change", handler);
                else if ((mq as any).removeListener)
                    (mq as any).removeListener(handler);
            };
        }
        return;
    }, [theme]);

    const setTheme = useCallback((t: Theme) => {
        try {
            if (t === "system") localStorage.removeItem(STORAGE_KEY);
            else localStorage.setItem(STORAGE_KEY, t);
        } catch {
            // ignore storage errors
        }
        setThemeState(t);
    }, []);

    const toggle = useCallback(() => {
        setThemeState((prev) => {
            const next = prev === "dark" ? "light" : "dark";
            try {
                // persist only if next is explicit choice; if toggling should switch to explicit, store it
                localStorage.setItem(STORAGE_KEY, next);
            } catch {}
            return next;
        });
    }, []);

    const value = useMemo(
        () => ({ theme, setTheme, toggle }),
        [theme, setTheme, toggle],
    );

    return (
        <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
    );
};

export function useTheme() {
    const ctx = useContext(ThemeContext);
    if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
    return ctx;
}
