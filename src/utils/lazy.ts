import { lazy } from "react";

export const lazyWithReload = (
    preload: Parameters<typeof lazy>[0],
    guard?: () => Promise<void>,
) => {
    const safeLoad = async () => {
        await guard?.();
        return preload().catch((err) => {
            window.location.reload();
            return Promise.reject(err);
        });
    };

    // 预加载
    Promise.resolve().then(() => {
        preload();
    });
    return lazy(safeLoad);
};
