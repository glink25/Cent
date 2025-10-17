/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";

declare const self: ServiceWorkerGlobalScope & {
    __WB_MANIFEST: Array<any>;
};

clientsClaim();
self.skipWaiting();

// 预缓存由 VitePWA 注入的所有静态资源
precacheAndRoute(self.__WB_MANIFEST);

// 🧩 Safari 导航修复核心逻辑
const navigationHandler = async (params: any) => {
    const handler = createHandlerBoundToURL("/index.html");
    const response = await handler(params);

    // Safari 兼容：重新构造 Response，去除重定向元数据
    const cloned = response.clone();
    const body = await cloned.arrayBuffer();
    const headers = new Headers(cloned.headers);

    return new Response(body, {
        status: cloned.status,
        statusText: cloned.statusText,
        headers,
    });
};

registerRoute(new NavigationRoute(navigationHandler));
