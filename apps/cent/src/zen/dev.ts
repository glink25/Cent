export function isZenFallbackDevMode() {
    return import.meta.env.DEV && window.__CENT_ZEN_FALLBACK__ === true;
}
