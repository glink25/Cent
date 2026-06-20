import { resolve } from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
    plugins: [react(), tailwindcss()],
    resolve: { alias: { "#": resolve("./src") } },
    build: {
        outDir: "app-dist",
        rollupOptions: {
            input: {
                index: resolve("./index.html"),
            },
        },
    },
    server: { host: true, port: 2272 },
});
