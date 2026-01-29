import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
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
            inject: {
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
        resolve: {
            alias: {
                "@": resolve("./src"),
            },
        },
        worker: {
            format: "es",
        },
    };
});
