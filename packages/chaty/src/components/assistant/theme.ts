export type ThemePreference = "light" | "dark" | "system";

function resolveTheme(
    theme: ThemePreference | undefined,
    mediaQuery: MediaQueryList | undefined,
) {
    if (theme === "light" || theme === "dark") {
        return theme;
    }
    return mediaQuery?.matches ? "dark" : "light";
}

function applyResolvedTheme(theme: "light" | "dark") {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.style.colorScheme = theme;
}

export function applyThemePreference(theme?: ThemePreference) {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");
    const sync = () => applyResolvedTheme(resolveTheme(theme, mediaQuery));

    sync();

    if (theme && theme !== "system") {
        return () => {};
    }

    mediaQuery?.addEventListener("change", sync);
    return () => mediaQuery?.removeEventListener("change", sync);
}
