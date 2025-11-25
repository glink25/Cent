import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import Info from "unplugin-info/vite";
import { defineConfig, type PluginOption } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import { VitePWA } from "vite-plugin-pwa";

const shouldAnalyze = process.env.ANALYZE === "true";

const plugins: PluginOption[] = [
    Info(),
    react(),
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
                    url: "/add?data=%s",
                    client_mode: "focus-existing", // 优先聚焦现有窗口
                } as any,
            ],
        },
    }),
];

if (shouldAnalyze) {
    // 只有在环境变量 ANALYZE=true 时才添加分析插件
    plugins.push(analyzer());
}

// https://vite.dev/config/
export default defineConfig({
    plugins,
    resolve: {
        alias: {
            "@": resolve("./src"),
        },
    },
});
