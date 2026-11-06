import type { History, ToolMessage } from "./type";

export type ToolImage = { mimeType: string; data: string };

const images = new Map<string, ToolImage>();
const supported = new Set([
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/gif",
]);

/** Keep attachment bytes out of persisted tool results and text context. */
export function retainToolImage(message: ToolMessage) {
    if (message.formatted.name !== "readBillAttachment") return;
    const value = message.formatted.returns;
    if (!value || typeof value !== "object") return;
    if (
        !("data" in value) ||
        !("mimeType" in value) ||
        typeof value.data !== "string" ||
        typeof value.mimeType !== "string"
    )
        return;
    const imageId = crypto.randomUUID();
    const valid =
        supported.has(value.mimeType) && value.data.length <= 6_990_508;
    if (valid) {
        const oldest = images.keys().next().value;
        if (images.size >= 8 && oldest !== undefined) images.delete(oldest);
        images.set(imageId, { mimeType: value.mimeType, data: value.data });
        message.formatted.returns = { imageId, mimeType: value.mimeType };
    } else {
        message.formatted.returns = undefined;
        message.formatted.errors = {
            message: "Unsupported image attachment or size",
        };
    }
    message.raw = JSON.stringify(message.formatted);
}

/** Insert the media only after all results for a tool-call batch. */
export function withToolImages(history: History): History {
    const latestUser = history.findLastIndex(
        (message) => message.role === "user",
    );
    let pending: ToolImage[] = [];
    return history.flatMap((message, index) => {
        if (
            index > latestUser &&
            message.role === "tool" &&
            message.formatted.name === "readBillAttachment"
        ) {
            const result = message.formatted.returns;
            const token =
                result && typeof result === "object" && "imageId" in result
                    ? result.imageId
                    : undefined;
            const image =
                typeof token === "string" ? images.get(token) : undefined;
            if (image) pending.push(image);
        }
        if (
            message.role !== "tool" ||
            history[index + 1]?.role === "tool" ||
            !pending.length
        )
            return [message];
        const assets = pending;
        pending = [];
        return [
            message,
            {
                role: "user",
                raw: "Image attachments retrieved from the current ledger by the preceding tools.",
                toolImages: assets,
            },
        ];
    });
}
