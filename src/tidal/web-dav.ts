// TODO: Test webdav
import type { FileStat, WebDAVClient, WebDAVClientOptions } from "webdav";
import type { UserInfo } from "@/api/endpoints/type";
import type { FileEntry } from "@/database/assets";
import { shortId } from "@/database/id";
import { registerProxy } from "@/utils/fetch-proxy";
import type {
    AssetKey,
    FileLike,
    FileWithContent,
    StoreStructure,
    Syncer,
} from ".";

type WebDAVConfig = {
    remoteUrl: string;
    username?: string;
    password?: string;
    proxy?: string;
    repoPrefix?: string;
    entryName?: string;
    baseDir?: string;
};

const createClient = async (
    remoteURL: string,
    options: WebDAVClientOptions,
    proxy?: string,
) => {
    const lib = await import("webdav");
    const dispose = registerProxy(async (url, opts, next) => {
        if (!proxy) return next(url, opts);
        const urlStr = typeof url === "string" ? url : url.toString();
        if (!urlStr.startsWith(remoteURL)) return next(url, opts);

        const proxyUrl = new URL(proxy);
        proxyUrl.searchParams.set("url", urlStr);
        const hasMethodParam = [...proxyUrl.searchParams.keys()].includes(
            "method",
        );
        const originalMethod = ((opts && opts.method) || "GET").toUpperCase();
        if (hasMethodParam && originalMethod !== "POST") {
            proxyUrl.searchParams.set("method", originalMethod);
            opts = { ...opts, method: "POST" };
        }
        return next(proxyUrl.toString(), opts);
    });
    return [lib.createClient(remoteURL, options), dispose] as const;
};

/** 将 WebDAV FileStat 映射为 Syncer 期望的结构，并构造 sha */
const statToFileLike = (file: FileStat, basePathPrefix = ""): FileLike => {
    // compute a simple sha-like identifier from available metadata
    const etag = file.etag ?? "";
    const lastmod = file.lastmod ?? "";
    const size = file.size ?? 0;
    const sha = `${etag}:${lastmod}:${size}`;

    // derive relative path (strip leading base prefix if provided)
    const path = basePathPrefix
        ? file.filename.replace(basePathPrefix, "").replace(/^\//, "")
        : file.filename;

    return {
        path,
        etag: file.etag ?? null,
        lastmod: file.lastmod ?? "",
        size: file.size ?? 0,
        // expose `sha` under the `sha` property to satisfy Syncer expectations
        // TS: FileLike in repo likely contains sha, but if not, keep as cast
        ...(Object.create(null) as any),
        sha,
    } as unknown as FileLike;
};

const treeStatsToStructure = (
    files: FileStat[],
    entryName: string,
    storePathPrefix: string,
): StoreStructure => {
    const structure = {
        chunks: [] as FileLike[],
        assets: [] as FileLike[],
        meta: { path: "", sha: "", size: 0 } as any,
    } as StoreStructure;

    for (const f of files) {
        if (f.type === "directory") continue;
        const relative = f.filename
            .replace(storePathPrefix, "")
            .replace(/^\//, "");
        if (relative === "meta.json") {
            const fl = statToFileLike(
                { ...f, filename: f.filename },
                storePathPrefix,
            );
            structure.meta = {
                path: relative,
                sha: (fl as any).sha,
            };
        } else if (relative.startsWith("assets/")) {
            const fl = statToFileLike(
                { ...f, filename: f.filename },
                storePathPrefix,
            );
            structure.assets.push({ ...fl, path: relative });
        } else if (
            relative.startsWith(`${entryName}-`) &&
            relative.endsWith(".json")
        ) {
            const startIndex = Number(
                relative.replace(`${entryName}-`, "").replace(".json", ""),
            );
            const fl = statToFileLike(
                { ...f, filename: f.filename },
                storePathPrefix,
            );
            structure.chunks.push({ ...fl, path: relative, startIndex });
        }
    }
    // sort chunks by startIndex for deterministic order
    structure.chunks.sort(
        (a: any, b: any) => (a.startIndex || 0) - (b.startIndex || 0),
    );
    return structure;
};

export const createWebDAVSyncer = (cfg: WebDAVConfig): Syncer => {
    const config = {
        baseDir: "cent",
        repoPrefix: "webdav-db",
        entryName: "entry",
        itemsPerChunk: 1000,
        ...cfg,
    };

    let clientInstance: WebDAVClient | undefined;
    const getClient = async () => {
        if (clientInstance) return clientInstance;
        const [client] = await createClient(
            config.remoteUrl,
            {
                username: config.username,
                password: config.password,
            },
            config.proxy,
        );
        clientInstance = client;
        return clientInstance;
    };

    const fetchStructure = async (storeFullName: string) => {
        const client = await getClient();
        const storePath = `${config.baseDir}/${storeFullName}`;
        try {
            const files = (await client.getDirectoryContents(storePath, {
                deep: true,
            })) as FileStat[];
            return treeStatsToStructure(files, config.entryName!, storePath);
        } catch (e: any) {
            if (e?.status === 404) {
                return {
                    chunks: [],
                    assets: [],
                    meta: { path: "", sha: "", size: 0 },
                } as StoreStructure;
            }
            throw e;
        }
    };

    const fetchContent = async (storeFullName: string, files: FileLike[]) => {
        const client = await getClient();
        const storePath = `${config.baseDir}/${storeFullName}`;
        return Promise.all(
            files.map(async (f) => {
                // f.path is relative (e.g., "entry-0.json")
                const fullPath = `${storePath}/${f.path}`;
                const text = (await client.getFileContents(fullPath, {
                    format: "text",
                })) as string;
                const content = text ? JSON.parse(text) : undefined;
                // ensure sha computed same way as in structure
                const sha = `${(f as any).etag ?? ""}:${(f as any).lastmod ?? ""}:${(f as any).size ?? 0}`;
                return { path: f.path, sha, content } as FileWithContent;
            }),
        );
    };

    const uploadContent = async (
        storeFullName: string,
        files: { path: string; content: any }[],
    ) => {
        const client = await getClient();
        const storePath = `${config.baseDir}/${storeFullName}`;

        // ensure store dir exists
        await client.createDirectory(storePath, { recursive: true });

        // process files in series (safe for WebDAV with concurrency limits)
        for (const f of files) {
            const fullPath = `${storePath}/${f.path}`;
            if (f.content === null || f.content === undefined) {
                // delete if exists (some servers may return 404, ignore)
                try {
                    await client.deleteFile(fullPath);
                } catch (e: any) {
                    if (e?.status !== 404) throw e;
                }
            } else {
                // if it's a File/Blob, upload as binary; otherwise stringify.
                if (typeof (f.content as any).arrayBuffer === "function") {
                    // Blob / File
                    const arr = await (f.content as Blob).arrayBuffer();
                    await client.putFileContents(fullPath, arr);
                } else {
                    const contentStr =
                        typeof f.content === "string"
                            ? f.content
                            : JSON.stringify(f.content, null, 2);
                    await client.putFileContents(fullPath, contentStr);
                }
            }
        }

        // after upload, re-fetch structure to return updated structure (to be consistent with github.uploadContent behaviour)
        const filesList = (await client.getDirectoryContents(storePath, {
            deep: true,
        })) as FileStat[];
        return treeStatsToStructure(filesList, config.entryName!, storePath);
    };

    const transformAsset = (file: File, storeFullName: string) => {
        return `assets/${shortId()}-${file.name}`;
    };

    const assetEntryToPath = (a: FileEntry<string>, storePath: string) => {
        return a.formattedValue
            .replace(storePath.replace(/^\//, ""), "")
            .replace(/^\//, "");
    };

    const getAsset = async (fileKey: AssetKey, storeFullName: string) => {
        // We expect fileKey to be a path/URL pointing to the asset under this server.
        // If fileKey is a full URL and starts with remoteUrl, extract the path after remoteUrl.
        const client = await getClient();
        const prefix = config.remoteUrl.replace(/\/$/, "");
        let path = String(fileKey);
        if (path.startsWith(prefix)) {
            // cut off protocol+host part
            path = path.replace(prefix, "");
            path = path.replace(/^\/+/, "");
        }
        // If fileKey already is a relative path under store (e.g., "cent/store/assets/xxx"), accept it
        try {
            const blob = (await client.getFileContents(path, {
                format: "binary",
            })) as unknown as Blob;
            return blob;
        } catch (e) {
            // fallback: try under store base path
            const alt = `${config.baseDir}/${storeFullName}/${String(fileKey).replace(/^\/+/, "")}`;
            const b = (await client.getFileContents(alt, {
                format: "binary",
            })) as unknown as Blob;
            return b;
        }
    };

    const createStore = async (name: string) => {
        const client = await getClient();
        const storeName = `${config.repoPrefix}-${name}`;
        const storePath = `${config.baseDir}/${storeName}`;
        await client.createDirectory(storePath, { recursive: true });
        await client.putFileContents(
            `${storePath}/meta.json`,
            JSON.stringify({}),
        );
        await client.createDirectory(`${storePath}/assets`);
        // return id and name similar to github.createStore
        return { id: storeName, name: storeName };
    };

    const getUserInfo = async (id?: string) => {
        // WebDAV servers do not have standardized user API; return simple info based on username
        return {
            avatar_url: undefined,
            name: config.username ?? "webdav-user",
            id: config.username ?? "webdav-user",
        } as unknown as UserInfo;
    };

    const getCollaborators = async (_id: string) => {
        // No standard collaborator list in WebDAV
        return [] as any[];
    };

    const fetchAllStore = async () => {
        const client = await getClient();
        try {
            const contents = (await client.getDirectoryContents(
                config.baseDir!,
            )) as FileStat[];
            return contents
                .filter(
                    (c) =>
                        c.type === "directory" &&
                        c.basename?.startsWith(config.repoPrefix!),
                )
                .map((c) => c.basename);
        } catch (e: any) {
            if (e?.status === 404) return [];
            throw e;
        }
    };

    return {
        fetchAllStore,
        fetchStructure,
        fetchContent,
        uploadContent,
        transformAsset,
        getAsset,
        createStore,
        getUserInfo,
        getCollaborators,
        assetEntryToPath,
    };
};
