import type { AIConfig, ImageInput } from "./types";

export function supportsImages(config: AIConfig) {
    if (config.imageInput !== undefined) return config.imageInput;
    try {
        const host = new URL(config.apiUrl).hostname;
        return (
            (host === "api.deepseek.com" &&
                config.model === "deepseek-flash") ||
            (host === "generativelanguage.googleapis.com" &&
                config.apiType === "google-ai-studio")
        );
    } catch {
        return false;
    }
}

export const isImage = (file: File) => file.type.startsWith("image/");

export async function encodeImages(files: File[]): Promise<ImageInput[]> {
    const maxImage = 5 * 1024 * 1024;
    if (
        files.some((file) => file.size > maxImage) ||
        files.reduce((total, file) => total + file.size, 0) > 3 * maxImage
    ) {
        throw new Error("图片超出大小限制（单图 5 MiB，每次请求 15 MiB）。");
    }
    return Promise.all(
        files.map(async (file) => {
            if (
                !["image/jpeg", "image/png", "image/webp"].includes(file.type)
            ) {
                throw new Error("请选择 JPEG、PNG 或 WebP 图片。");
            }
            const bytes = new Uint8Array(await file.arrayBuffer());
            let binary = "";
            for (let i = 0; i < bytes.length; i += 8192) {
                binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
            }
            return { mimeType: file.type, data: btoa(binary) };
        }),
    );
}
