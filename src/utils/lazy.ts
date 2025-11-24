import { lazy } from "react";

export const lazyWithReload: typeof lazy = (load) => {
    const safeLoad = () =>
        load().catch((err) => {
            window.location.reload();
            return Promise.reject(err);
        });

    // 预加载
    Promise.resolve().then(() => {
        safeLoad();
    });
    return lazy(safeLoad);
};
