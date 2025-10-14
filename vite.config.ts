import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";

// import { analyzer } from "vite-bundle-analyzer";

import { readFileSync } from "node:fs";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const packageJSON = readFileSync("./package.json", { encoding: "utf-8" });
const packageValue = JSON.parse(packageJSON);

// https://vite.dev/config/
export default defineConfig({
    define: {
        // Provide an explicit app-level constant derived from an env var.
        __BUILD_INFO: { version: `${packageValue.version}` },
    },
    plugins: [
        react(),
        tailwindcss(),
        VitePWA({
            registerType: "autoUpdate",
            injectRegister: "auto",
            includeAssets: ["favicon.ico", "apple-touch-icon.png"],
            manifest: {
                name: "Cent - 日计",
                short_name: "Cent",
                description: "Accounting  your life - 记录每一天",
                theme_color: "#ffffff",
                icons: [
                    {
                        src: "icon.png",
                        sizes: "192x192",
                        type: "image/png",
                    },
                    {
                        src: "icon.png",
                        sizes: "512x512",
                        type: "image/png",
                    },
                ],
            },
        }) as any,
        // analyzer(),
    ],
    resolve: {
        alias: {
            "@": resolve("./src"),
        },
    },
});
