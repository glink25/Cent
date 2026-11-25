import { StorageAPI } from "@/api/storage";
import { cacheInDB } from "@/utils/cache";
import { GetOnlineAssetsCacheKey } from "@/utils/constant";

export type AttachmentSource = string | File;

/** Resolve private storage references through the same cache as thumbnails. */
export async function resolveAttachment(
    source: AttachmentSource,
    bookId?: string,
): Promise<Blob | string> {
    if (source instanceof File) return source;
    if (/^(data:|blob:)/i.test(source)) return source;
    if (bookId && StorageAPI.getOnlineAsset) {
        const load =
            StorageAPI.type === "folder"
                ? StorageAPI.getOnlineAsset
                : cacheInDB(StorageAPI.getOnlineAsset, GetOnlineAssetsCacheKey);
        const file = await load(source, bookId);
        if (file) return file;
    }
    return source;
}

export function attachmentFileName(source: AttachmentSource, type: string) {
    if (source instanceof File && source.name) return source.name;
    if (typeof source === "string" && !/^(data:|blob:)/i.test(source)) {
        const name = source.split(/[?#]/)[0]?.split("/").pop();
        if (name) {
            try {
                return decodeURIComponent(name);
            } catch {
                return name;
            }
        }
    }
    const extension = {
        "image/jpeg": "jpg",
        "image/png": "png",
        "image/gif": "gif",
        "image/webp": "webp",
        "image/svg+xml": "svg",
    }[type];
    return `cent-attachment.${extension ?? "bin"}`;
}

/** Download bytes, never a screenshot or a re-encoded preview. */
export async function attachmentToFile(
    source: AttachmentSource,
    resolved: Blob | string,
): Promise<File> {
    if (resolved instanceof File) return resolved;
    let blob: Blob;
    if (typeof resolved === "string") {
        const response = await fetch(resolved, { credentials: "same-origin" });
        if (!response.ok)
            throw new Error(`Unable to load attachment: ${response.status}`);
        blob = await response.blob();
    } else {
        blob = resolved;
    }
    return new File([blob], attachmentFileName(source, blob.type), {
        type: blob.type,
    });
}
