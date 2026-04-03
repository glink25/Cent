import { strFromU8, strToU8, unzip, zip } from "fflate";
import { StorageAPI } from "@/api/storage";
import type { Bill, ExportedJSON } from "@/ledger/type";
import { cacheInDB } from "@/utils/cache";
import { GetOnlineAssetsCacheKey } from "@/utils/constant";
import { base64ToFile } from "@/utils/file";

const BACKUP_JSON_FILE = "backup.json";
const ASSET_PREFIX = "assets/";

const MIME_BY_EXTENSION: Record<string, string> = {
    gif: "image/gif",
    jpeg: "image/jpeg",
    jpg: "image/jpeg",
    json: "application/json",
    png: "image/png",
    svg: "image/svg+xml",
    webp: "image/webp",
};

const unzipAsync = (data: Uint8Array) => {
    return new Promise<Record<string, Uint8Array>>((resolve, reject) => {
        unzip(data, (error, files) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(files);
        });
    });
};

const zipAsync = (data: Record<string, Uint8Array>) => {
    return new Promise<Uint8Array>((resolve, reject) => {
        zip(data, { level: 6 }, (error, zipped) => {
            if (error) {
                reject(error);
                return;
            }
            resolve(zipped);
        });
    });
};

const getFileExtension = (fileName: string, fallbackType?: string) => {
    const extension = fileName.split(".").pop()?.trim().toLowerCase();
    if (extension && extension !== fileName.toLowerCase()) {
        return extension;
    }
    const typeExtension = fallbackType?.split("/").pop()?.toLowerCase();
    return typeExtension && typeExtension !== "octet-stream"
        ? typeExtension
        : "bin";
};

const getMimeType = (fileName: string, fallbackType?: string) => {
    if (fallbackType) {
        return fallbackType;
    }
    return (
        MIME_BY_EXTENSION[getFileExtension(fileName)] ??
        "application/octet-stream"
    );
};

const getAssetFileName = (
    billId: string,
    imageIndex: number,
    sourceName?: string,
    sourceType?: string,
) => {
    const safeBillId = billId.replaceAll(/[^a-zA-Z0-9_-]/g, "-");
    const extension = getFileExtension(sourceName ?? "", sourceType);
    return `${ASSET_PREFIX}${safeBillId}-${imageIndex}.${extension}`;
};

const getImportedFileName = (assetPath: string) => {
    return assetPath.split("/").pop() || "asset";
};

const getUrlFileName = (value: string) => {
    const path = value.split(/[?#]/)[0] ?? value;
    return path.split("/").pop() || "asset";
};

const normalizeZipAssetPath = (value: string) => {
    return value.replace(/^\.\//, "");
};

const mapImportImages = async (
    items: ExportedJSON["items"],
    assets: Record<string, Uint8Array>,
) => {
    return await Promise.all(
        items.map(async (item) => {
            if (!item.images?.length) {
                return item;
            }
            const images = await Promise.all(
                item.images.map(async (image) => {
                    if (typeof image !== "string") {
                        return image;
                    }
                    if (
                        image.startsWith(ASSET_PREFIX) ||
                        image.startsWith(`./${ASSET_PREFIX}`)
                    ) {
                        const assetPath = normalizeZipAssetPath(image);
                        const assetData = assets[assetPath];
                        if (!assetData) {
                            throw new Error(
                                `Missing asset in backup: ${assetPath}`,
                            );
                        }
                        const mimeType = getMimeType(assetPath);
                        const blob = new Blob([assetData as any], {
                            type: mimeType,
                        });
                        return new File(
                            [blob],
                            getImportedFileName(assetPath),
                            {
                                type: mimeType,
                            },
                        );
                    }
                    return image;
                }),
            );
            return { ...item, images };
        }),
    );
};

const fileToUint8Array = async (file: Blob) => {
    return new Uint8Array(await file.arrayBuffer());
};

const resolveImageFile = async (image: string | File, bookId: string) => {
    if (image instanceof File) {
        return image;
    }
    if (image.startsWith("data:")) {
        return await base64ToFile(image);
    }

    const getOnlineAsset = StorageAPI.getOnlineAsset
        ? cacheInDB(StorageAPI.getOnlineAsset, GetOnlineAssetsCacheKey)
        : undefined;
    const blob = await getOnlineAsset?.(image, bookId);
    if (!blob) {
        throw new Error(`Unable to load asset for export: ${image}`);
    }
    return new File([blob], getUrlFileName(image), {
        type: getMimeType(getUrlFileName(image), blob.type),
    });
};

const mapExportImages = async (
    items: ExportedJSON["items"],
    bookId: string,
) => {
    const files: Record<string, Uint8Array> = {};
    const mappedItems = await Promise.all(
        items.map(async (item) => {
            if (!item.images?.length) {
                return item;
            }
            const images = await Promise.all(
                item.images.map(async (image, imageIndex) => {
                    const file = await resolveImageFile(image, bookId);
                    const assetPath = getAssetFileName(
                        item.id,
                        imageIndex,
                        file.name,
                        file.type,
                    );
                    files[assetPath] = await fileToUint8Array(file);
                    return assetPath;
                }),
            );
            return {
                ...item,
                images,
            } satisfies Bill;
        }),
    );
    return { items: mappedItems, files };
};

export const processImportFile = async (backupFile: File) => {
    const isZip =
        backupFile.type === "application/zip" ||
        backupFile.name.endsWith(".zip");
    if (!isZip) {
        const jsonText = await backupFile.text();
        return JSON.parse(jsonText) as ExportedJSON;
    }

    const zipData = new Uint8Array(await backupFile.arrayBuffer());
    const files = await unzipAsync(zipData);
    const jsonData = files[BACKUP_JSON_FILE];
    if (!jsonData) {
        throw new Error(`Missing ${BACKUP_JSON_FILE} in backup zip`);
    }
    const data = JSON.parse(strFromU8(jsonData)) as ExportedJSON;
    return {
        ...data,
        items: await mapImportImages(data.items, files),
    };
};

export const prepareExportFile = async (bookId: string) => {
    const [items, meta] = await Promise.all([
        StorageAPI.getAllItems(bookId),
        StorageAPI.getMeta(bookId),
    ]);
    const { items: exportedItems, files } = await mapExportImages(
        items,
        bookId,
    );
    const json = JSON.stringify({
        items: exportedItems,
        meta,
    } as ExportedJSON);

    const zipped = await zipAsync({
        [BACKUP_JSON_FILE]: strToU8(json),
        ...files,
    });
    const blob = new Blob([zipped as any], { type: "application/zip" });

    return { blob, ext: "cent.zip" };
};
