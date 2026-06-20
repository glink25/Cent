import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { buildSync } from "esbuild";
import Info from "unplugin-info/vite";
import { defineConfig, loadEnv, type PluginOption } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import { createHtmlPlugin } from "vite-plugin-html";
import { VitePWA } from "vite-plugin-pwa";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd());

    const shouldAnalyze = process.env.ANALYZE === "true";

    const plugins: PluginOption[] = [
        Info(),
        createHtmlPlugin({
            pages: [
                {
                    filename: "index.html",
                    template: "index.html",
                    injectOptions: {
                        data: {
                            VITE_GTAG_SCRIPT: env.VITE_GTAG_SCRIPT || "",
                            injectPresetScript: buildSync({
                                entryPoints: ["src/inline/load-preset.ts"],
                                bundle: true,
                                minify: true,
                                write: false,
                                format: "iife",
                            }).outputFiles[0].text,
                        },
                    },
                },
            ],
        }),
        react(),
        svgr(),
        tailwindcss(),
        VitePWA({
            strategies: "injectManifest",
            srcDir: "src",
            filename: "sw.ts",
            registerType: "autoUpdate",
            injectRegister: "auto",
            includeAssets: ["favicon.ico", "apple-touch-icon.png"],
            manifest: {
                name: "Cent - 日计",
                short_name: "Cent",
                description: "Accounting your life - 记录每一天",
                theme_color: "#ffffff",
                icons: [
                    { src: "icon.png", sizes: "192x192", type: "image/png" },
                    { src: "icon.png", sizes: "512x512", type: "image/png" },
                ],
                protocol_handlers: [
                    {
                        protocol: "cent-accounting",
                        url: "/add-bills?text=%s",
                        client_mode: "focus-existing", // 优先聚焦现有窗口
                    } as any,
                ],
                launch_handler: {
                    client_mode: ["navigate-existing", "auto"], // 优先在现有窗口导航
                },
                // 注意：标准 URL 链接唤起通过应用层面的 URL 参数处理实现
                // 见 src/hooks/use-url-handler.tsx
            },
        }),
    ];

    if (shouldAnalyze) {
        // 只有在环境变量 ANALYZE=true 时才添加分析插件
        plugins.push(analyzer());
    }
    return {
        plugins,
        build: {
            // 产物输出到仓库根 dist/（apps/cent 上溯两级），保持现有 `pnpm run build`
            // 行为与 Cloudflare 的输出目录（dist）不变。resolve 以 cwd(apps/cent) 为基准。
            outDir: resolve("../../dist"),
            emptyOutDir: true,
            rollupOptions: {
                output: {
                    manualChunks: (id) => {
                        if (id.includes("zod")) {
                            return "zod";
                        }
                        if (id.includes("@dnd-kit")) {
                            return "dndkit";
                        }
                        if (id.includes("echarts")) {
                            return "echarts";
                        }
                        if (id.includes("react-day-picker")) {
                            return "reactDayPicker";
                        }
                    },
                },
            },
        },
        resolve: {
            alias: {
                "@": resolve("./src"),
            },
        },
        // chaty / zen 是 workspace 源码包（非预编译 dist），交给 Vite 直接当源码处理，
        // 不要被 esbuild 预打包成外部依赖（否则其 `#/` 子路径导入与 Tailwind 扫描会失效）。
        optimizeDeps: {
            exclude: ["@glink25/chaty", "@glink25/zen"],
        },
        worker: {
            format: "es",
        },
        server: {
            proxy: {
                // 这里的 '/api' 是你在代码中调用的路径前缀
                "/google-api": {
                    target: "https://generativelanguage.googleapis.com", // 目标接口域名
                    changeOrigin: true, // 必须设置为 true，以便绕过主机检查
                    rewrite: (path) => path.replace(/^\/google-api/, ""), // 去掉路径中的前缀
                    // 如果你的网络环境需要科学上网，且使用了本地代理软件，可能需要配置此项（可选）
                    // secure: false,
                },
            },
        },
    };
});
