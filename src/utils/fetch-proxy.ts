// 保存原始 fetch
const originalFetch = self.fetch.bind(self);

type Handler = (
    url: RequestInfo | URL,
    options: RequestInit,
    next: typeof originalFetch,
) => Promise<Response>;

// 存储所有已注册的代理（按顺序执行）
const proxyHandlers: Handler[] = [];

/**
 * 注册一个 fetch 代理
 * @param handler 代理函数，接收 (url, options, next)
 * @returns dispose() 函数，用于移除该代理
 */
function registerProxy(handler: Handler) {
    proxyHandlers.push(handler);
    console.log(
        `[fetch-proxy] registered proxy, total = ${proxyHandlers.length}`,
    );

    // 返回取消注册函数
    return () => {
        const index = proxyHandlers.indexOf(handler);
        if (index !== -1) {
            proxyHandlers.splice(index, 1);
            console.log(
                `[fetch-proxy] proxy removed, total = ${proxyHandlers.length}`,
            );
        }
    };
}

// 组合代理链：像中间件一样层层包裹
function composeFetchChain(
    handlers: Handler[],
    baseFetch: typeof originalFetch,
) {
    return handlers.reduceRight(
        (next, handler) => (url, options) => handler(url, options, next as any),
        baseFetch,
    );
}

// 替换全局 fetch
self.fetch = async (url: RequestInfo | URL, options: RequestInit = {}) => {
    if (proxyHandlers.length === 0) {
        return originalFetch(url, options);
    }

    const composed = composeFetchChain(proxyHandlers, originalFetch);
    return (composed as any)(url, options);
};

// 导出 registerProxy
export { registerProxy };
