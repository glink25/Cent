/// <reference lib="webworker" />

import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";
import { createHandlerBoundToURL, precacheAndRoute } from "workbox-precaching";
import { NavigationRoute, registerRoute } from "workbox-routing";
import { CacheFirst } from "workbox-strategies";

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

// 不处理 .well-known、__headers 等站点元数据路径，直接走网络
registerRoute(
    new NavigationRoute(navigationHandler, {
        denylist: [
            /\/\.well-known(\/|$)/,
            /\/__headers(\/|$)/,
            /\/ai-chat(\.html)?(\/|$)/,
        ],
    }),
);

// 缓存第三方cdn逻辑
registerRoute(
    ({ url }) => url.href.startsWith("https://cdn.jsdelivr.net/npm/jieba-wasm"),

    // 缓存策略
    new CacheFirst({
        cacheName: "cdn-jieba-wasm-cache",
        plugins: [
            // 可缓存响应插件 (确保缓存跨域的 Opaque Response)
            new CacheableResponsePlugin({
                statuses: [0, 200],
            }),
        ],
    }),
);
