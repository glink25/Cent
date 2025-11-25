declare var window: {
    launchQueue: {
        setConsumer: (callback: (v: { targetURL: string }) => void) => void;
    };
};

/** PWA快速记账 */
export const register = () => {
    if ("launchQueue" in window) {
        window.launchQueue.setConsumer((launchParams) => {
            if (launchParams.targetURL) {
                // 获取完整的启动 URL，例如: https://your-pwa.com/play?track=web+music%3A%2F%2Ftrack%2F123
                const url = new URL(launchParams.targetURL);

                // 在这里处理你想要的参数
                const fullProtocolUrl = url.searchParams.get("data");

                // 进一步解析 fullProtocolUrl (例如: web+music://track/123) 来提取实际的参数
                console.log("PWA 启动的完整协议 URL:", fullProtocolUrl);

                // 你的 PWA 逻辑: 播放相应的曲目
                // ...
            }
        });
    }
};
