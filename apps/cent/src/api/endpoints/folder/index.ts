import { openDB } from "idb";
import type { FileStat } from "webdav";
import type { Modal } from "@/components/modal";
import { t } from "@/locale";
import { createWebDAVSyncer, type TidalFileClient } from "@/tidal/web-dav";
import type { SyncEndpointFactory } from "../type";
import { createFileEndpoint } from "../web-dav";

type Directory = FileSystemDirectoryHandle &
    AsyncIterable<[string, FileSystemFileHandle | Directory]> & {
        queryPermission(options: {
            mode: "readwrite";
        }): Promise<PermissionState>;
    };

const picker = () =>
    (
        window as Window & {
            showDirectoryPicker?: (options: {
                mode: "readwrite";
            }) => Promise<Directory>;
        }
    ).showDirectoryPicker;

export const canPickFolder = () =>
    window.isSecureContext && typeof picker() === "function";
const mode = { mode: "readwrite" } as const;
const marker = "cent-storage-id";
const scopeKey = "cent-folder-id";
const activeScope =
    localStorage.getItem("SYNC_ENDPOINT") === "folder"
        ? localStorage.getItem(scopeKey)
        : null;
export const folderStoragePrefix = () =>
    activeScope ? `folder-${activeScope}-` : "";
window.addEventListener("storage", ({ key, newValue }) => {
    if (key === scopeKey && activeScope && newValue !== activeScope) {
        location.reload();
    }
});
const database = () =>
    openDB("cent-folder", 1, {
        upgrade: (db) => db.createObjectStore("handles"),
    });
const missing = (error: unknown) =>
    error instanceof DOMException && error.name === "NotFoundError";
const denied = (error: unknown) =>
    error instanceof DOMException &&
    (error.name === "NotAllowedError" || error.name === "SecurityError");

async function readIdentity(root: Directory) {
    const cent = await root.getDirectoryHandle("cent");
    const file = await (await cent.getFileHandle(marker)).getFile();
    const id = (await file.text()).trim().toLowerCase();
    if (!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id))
        throw new Error(t("folder-invalid-storage"));
    return id;
}

async function initializeIdentity(root: Directory) {
    try {
        return await readIdentity(root);
    } catch (error) {
        if (!missing(error)) throw error;
    }
    const cent = await root.getDirectoryHandle("cent", { create: true });
    const file = await (
        await cent.getFileHandle(marker, { create: true })
    ).createWritable();
    const id = crypto.randomUUID();
    await file.write(id);
    await file.close();
    return id;
}

export async function authorizeFolder(modal: Modal) {
    const choose = picker();
    if (!choose || !canPickFolder()) return;
    const endpoint = localStorage.getItem("SYNC_ENDPOINT");
    const expectedId =
        endpoint === "folder" ? localStorage.getItem(scopeKey) : null;
    try {
        const root = await choose.call(window, mode);
        await navigator.locks.request("cent-folder-authorize", async () => {
            if (
                localStorage.getItem("SYNC_ENDPOINT") !== endpoint ||
                (endpoint === "folder" &&
                    localStorage.getItem(scopeKey) !== expectedId)
            )
                return;

            let id: string;
            if (endpoint === "folder") {
                const selectedId = await readIdentity(root).catch((error) => {
                    if (missing(error)) return null;
                    throw error;
                });
                if (!expectedId || selectedId !== expectedId)
                    throw new Error(t("folder-different-storage"));
                id = expectedId;
            } else {
                id = await initializeIdentity(root);
            }
            const db = await database();
            try {
                await db.put("handles", root, id);
            } finally {
                db.close();
            }
            if (!expectedId) {
                localStorage.removeItem("book-store");
                localStorage.removeItem("user-store");
                localStorage.setItem(scopeKey, id);
                localStorage.setItem("SYNC_ENDPOINT", "folder");
            }
            location.reload();
        });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
            return;
        modal.toast.error(
            error instanceof Error ? error.message : String(error),
        );
    }
}

function segments(path: string) {
    const parts = path.replace(/^\//, "").split("/");
    if (
        parts.some(
            (part) =>
                !part || part === "." || part === ".." || part.includes("\\"),
        )
    ) {
        throw new Error("Invalid folder path");
    }
    return parts;
}

function makeFileClient(
    root: () => Promise<Directory>,
    onExpired: () => void,
): TidalFileClient {
    async function access<T>(operation: (directory: Directory) => Promise<T>) {
        try {
            return await operation(await root());
        } catch (error) {
            if (denied(error)) onExpired();
            if (missing(error))
                throw Object.assign(new Error("File does not exist"), {
                    status: 404,
                });
            throw error;
        }
    }
    async function directory(
        rootDirectory: Directory,
        parts: string[],
        create = false,
    ) {
        let current = rootDirectory;
        for (const part of parts)
            current = (await current.getDirectoryHandle(part, {
                create,
            })) as Directory;
        return current;
    }
    async function list(
        dir: Directory,
        path: string,
        deep: boolean,
        signal?: AbortSignal,
    ): Promise<FileStat[]> {
        const files: FileStat[] = [];
        for await (const [name, handle] of dir) {
            signal?.throwIfAborted();
            if (name.startsWith(".cent-")) continue;
            const filename = `${path}/${name}`;
            if (handle.kind === "directory") {
                files.push({
                    filename,
                    basename: name,
                    type: "directory",
                    size: 0,
                    lastmod: "",
                    etag: null,
                });
                if (deep && name === "assets")
                    files.push(
                        ...(await list(handle, filename, false, signal)),
                    );
            } else {
                const file = await handle.getFile();
                const etag =
                    name === "meta.json" ||
                    /^(ledger|zen)-[0-9]+\.json$/.test(name)
                        ? Array.from(
                              new Uint8Array(
                                  await crypto.subtle.digest(
                                      "SHA-256",
                                      await file.arrayBuffer(),
                                  ),
                              ),
                              (byte) => byte.toString(16).padStart(2, "0"),
                          ).join("")
                        : null;
                files.push({
                    filename,
                    basename: name,
                    type: "file",
                    size: file.size,
                    lastmod: String(file.lastModified),
                    etag,
                });
            }
        }
        return files;
    }
    return {
        createDirectory: (path) =>
            access(async (dir) => {
                await directory(dir, segments(path), true);
            }),
        getDirectoryContents: (path, options) =>
            access(async (dir) =>
                list(
                    await directory(dir, segments(path)),
                    path,
                    options?.deep ?? false,
                    options?.signal,
                ),
            ),
        getFileContents: (path, options) =>
            access(async (dir) => {
                options?.signal?.throwIfAborted();
                const parts = segments(path);
                const name = parts.pop()!;
                const parent = await directory(dir, parts);
                const file = await (await parent.getFileHandle(name)).getFile();
                return options?.format === "text"
                    ? file.text()
                    : file.arrayBuffer();
            }),
        putFileContents: (path, data) =>
            access(async (dir) => {
                if (typeof data !== "string" && !(data instanceof ArrayBuffer))
                    throw new Error("Unsupported file data");
                const parts = segments(path);
                const name = parts.pop()!;
                const parent = await directory(dir, parts, true);
                const writer = await (
                    await parent.getFileHandle(name, { create: true })
                ).createWritable({
                    mode: "exclusive",
                } as FileSystemCreateWritableOptions);
                try {
                    await writer.write(data);
                    await writer.close();
                } catch (error) {
                    await writer.abort().catch(() => undefined);
                    throw error;
                }
                return true;
            }),
        deleteFile: (path) =>
            access(async (dir) => {
                const parts = segments(path);
                const name = parts.pop()!;
                await (await directory(dir, parts)).removeEntry(name);
            }),
    };
}

export const FolderEndpoint: SyncEndpointFactory = {
    type: "folder",
    name: "Folder",
    login: ({ modal }) => authorizeFolder(modal),
    init: ({ modal }) => {
        const id = activeScope ?? "";
        let expired = false;
        const markExpired = () => {
            if (expired) return;
            expired = true;
            window.dispatchEvent(new Event("cent-folder-expired"));
            modal.toast.error(t("folder-authorization-expired"), {
                action: {
                    label: t("re-login"),
                    onClick: () => {
                        void authorizeFolder(modal);
                    },
                },
            });
        };
        const root = async () => {
            const db = await database();
            const handle = (await db.get("handles", id)) as
                | Directory
                | undefined;
            db.close();
            if (!handle || (await handle.queryPermission(mode)) !== "granted") {
                markExpired();
                throw new DOMException(
                    t("folder-authorization-expired"),
                    "NotAllowedError",
                );
            }
            try {
                if ((await readIdentity(handle)) === id) return handle;
            } catch (error) {
                if (!missing(error) && !denied(error)) throw error;
            }
            markExpired();
            throw new DOMException(
                t("folder-authorization-expired"),
                "NotAllowedError",
            );
        };
        const client = makeFileClient(root, markExpired);
        const endpoint = createFileEndpoint({
            modal,
            auth: { username: "me" },
            makeSyncer: (entryName) =>
                createWebDAVSyncer({ remoteUrl: "", entryName }, client),
            storagePrefix: folderStoragePrefix(),
            validate: root,
            runExclusive: (signal, task) =>
                navigator.locks.request(
                    `cent-folder-sync-${id}`,
                    { signal },
                    task,
                ),
            deleteBookMessage: () => t("folder-delete-book-manually"),
        });
        return {
            ...endpoint,
            logout: async () => {
                await endpoint.logout();
                const db = await database();
                await db.delete("handles", id);
                db.close();
            },
        };
    },
};
