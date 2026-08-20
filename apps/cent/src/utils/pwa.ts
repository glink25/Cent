import { registerSW } from "virtual:pwa-register";

const CHUNK_RELOAD_PREFIX = "cent:chunk-reload:";

const getChunkReloadKey = (payload: unknown) => {
    const message =
        payload instanceof Error
            ? payload.message
            : String(payload ?? "unknown");
    return `${CHUNK_RELOAD_PREFIX}${encodeURIComponent(message.slice(-256))}`;
};

window.addEventListener("vite:preloadError", (event) => {
    if (!navigator.onLine) {
        return;
    }

    const preloadEvent = event as Event & { payload?: unknown };
    const reloadKey = getChunkReloadKey(preloadEvent.payload);

    try {
        if (sessionStorage.getItem(reloadKey)) {
            return;
        }
        sessionStorage.setItem(reloadKey, "1");
    } catch {
        // 无法记录刷新状态时不自动刷新，避免形成刷新循环。
        return;
    }

    preloadEvent.preventDefault();
    if ("serviceWorker" in navigator) {
        void navigator.serviceWorker
            .getRegistration()
            .then((registration) => registration?.update())
            .finally(() => window.location.reload());
    } else {
        window.location.reload();
    }
});

export const registerPWAUpdates = () => {
    let updateSW: ReturnType<typeof registerSW> | undefined;

    updateSW = registerSW({
        immediate: true,
        onNeedRefresh() {
            // 等注册函数返回更新句柄后，立即激活新 SW 并刷新页面。
            queueMicrotask(() => {
                void updateSW?.(true);
            });
        },
        onRegisterError(error) {
            console.error("Service worker registration failed:", error);
        },
    });
};
