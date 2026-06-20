import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import Info from "unplugin-info/vite";
import { defineConfig, type PluginOption } from "vite";
import { analyzer } from "vite-bundle-analyzer";
import svgr from "vite-plugin-svgr";

export default defineConfig(() => {
    const shouldAnalyze = process.env.ANALYZE === "true";

    const plugins: PluginOption[] = [Info(), react(), svgr(), tailwindcss()];

    if (shouldAnalyze) {
        plugins.push(analyzer());
    }

    return {
        plugins,
        build: {
            // HTML/iframe 产物输出到 app-dist，避免与库构建的 dist/ 冲突。
            outDir: "app-dist",
            rollupOptions: {
                input: {
                    index: resolve("./index.html"),
                },
            },
        },
        server: {
            port: 2271,
            host: true,
        },
        resolve: {
            alias: {
                "#": resolve("./src"),
            },
        },
        worker: {
            format: "es" as const,
        },
    };
});
