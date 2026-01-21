import type { FileStat, WebDAVClient, WebDAVClientOptions } from "webdav";
import type { UserInfo } from "@/api/endpoints/type";
import type { FileEntry } from "@/database/assets";
import { shortId } from "@/database/id";
import { registerProxy } from "@/utils/fetch-proxy";
import type { AssetKey, FileLike, StoreStructure, Syncer } from ".";

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

const fileStatToSha = (file: FileStat) => {
    const etag = file.etag ?? "";
    const lastmod = file.lastmod ?? "";
    const size = file.size ?? 0;
    const sha = `${etag}:${lastmod}:${size}`;
    return sha;
};
/**
 * 将 WebDAV 文件列表解析为 StoreStructure
 * @param files WebDAV client.getDirectoryContents 返回的文件列表
 * @param entryName 集合名称
 * @param basePath store 的基础路径 (例如 /webdav-db/my-store)
 */
const fileStatsToStructure = (
    files: FileStat[],
    entryName: string,
    basePath: string,
) => {
    const structure: StoreStructure<{
        path: string;
        sha: string;
        etag?: string;
        lastmod: string;
        size: number;
    }> = {
        chunks: [],
        assets: [],
        meta: { path: "", sha: "", etag: undefined, lastmod: "", size: 0 },
    };

    for (const file of files) {
        if (file.type === "directory") continue;

        // 获取相对于 store 根目录的路径
        const relativePath = file.filename
            .split(basePath)[1]
            .replace(/^\//, "");

        if (relativePath === "meta.json") {
            structure.meta = {
                path: relativePath,
                sha: fileStatToSha(file),
                etag: file.etag ?? undefined,
                lastmod: file.lastmod,
                size: file.size,
            };
        } else if (relativePath.startsWith("assets/")) {
            structure.assets.push({
                path: relativePath,
                ...file,
                sha: fileStatToSha(file),
                etag: file.etag ?? undefined,
                lastmod: file.lastmod,
                size: file.size,
            });
        } else if (
            relativePath.startsWith(`${entryName}-`) &&
            relativePath.endsWith(`.json`)
        ) {
            const startIndex = Number(
                relativePath.replace(`${entryName}-`, "").replace(".json", ""),
            );
            structure.chunks.push({
                ...file,
                path: relativePath,
                sha: fileStatToSha(file),
                etag: file.etag ?? undefined,
                startIndex,
            });
        }
    }

    // 按照startIndex数字顺序对chunks进行排序
    // WebDAV返回的是字典序（ledger-1000, ledger-10000, ledger-2000）
    // 需要按数字排序（ledger-1000, ledger-2000, ledger-10000）
    structure.chunks.sort((a, b) => a.startIndex - b.startIndex);

    // 对assets按路径排序，保持一致性
    structure.assets.sort((a, b) => a.path.localeCompare(b.path));

    return structure;
};

export const createWebDAVSyncer = (cfg: WebDAVConfig): Syncer => {
    const config = {
        baseDir: "cent",
        repoPrefix: "cent-journal",
        entryName: "ledger",
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

    const fetchStructure = async (
        storeFullName: string,
        signal?: AbortSignal,
    ) => {
        const client = await getClient();
        const storePath = `${config.baseDir}/${storeFullName}`;
        try {
            const files = (await client.getDirectoryContents(storePath, {
                deep: true,
                signal,
            })) as FileStat[];
            const structure = fileStatsToStructure(
                files,
                config.entryName,
                storePath,
            );
            return structure;
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

    const fetchContent = async (
        storeFullName: string,
        files: FileLike[],
        signal?: AbortSignal,
    ) => {
        const client = await getClient();
        const storePath = `${config.baseDir}/${storeFullName}`;
        // 存储结果的数组
        const results = [];

        // 使用 for...of 循环确保对 files 列表中的每一项操作是串行（非并发）的
        for (const file of files) {
            const filePath = `${storePath}/${file.path}`;
            try {
                const content = (await client.getFileContents(filePath, {
                    format: "text",
                    signal,
                })) as string;
                const sha = `${(file as any).etag ?? ""}:${(file as any).lastmod ?? ""}:${(file as any).size ?? 0}`;
                // 返回 FileWithConentLike 结构，并加入结果数组
                results.push({ ...file, sha, content: JSON.parse(content) });
            } catch (e) {
                console.error(`Failed to fetch ${filePath}:`, e);
                // // 处理文件读取失败，并加入结果数组
                // results.push({ ...file, content: undefined });
                throw e;
            }
        }
        return results;
    };

    const uploadContent = async (
        storeFullName: string,
        files: { path: string; content: any }[],
        signal?: AbortSignal,
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
        return fileStatsToStructure(filesList, config.entryName, storePath);
    };

    const transformAsset = (file: File, storeFullName: string) => {
        const assetPath = `assets/${shortId()}-${file.name}`;
        return `${config.baseDir}/${storeFullName}/${assetPath}`;
    };

    const assetEntryToPath = (a: FileEntry<string>, storePath: string) => {
        return a.formattedValue
            .replace(`${config.baseDir}/${storePath}/`.replace(/^\//, ""), "")
            .replace(/^\//, "");
    };

    const getAsset = async (fileKey: AssetKey, storeFullName: string) => {
        // 从 URL 中提取路径
        const path = fileKey;

        try {
            const client = await getClient();
            const arrayBuffer = (await client.getFileContents(path, {
                format: "binary",
            })) as unknown as ArrayBuffer;
            const blob = new Blob([arrayBuffer]);
            return blob;
        } catch (e) {
            console.error(`getOnlineAsset failed for path ${path}:`, e);
            throw e;
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

export const checkWebDAVConfig = async (
    config: Pick<WebDAVConfig, "username" | "password" | "remoteUrl" | "proxy">,
) => {
    const { remoteUrl, username, password, proxy } = config;
    const [client, dispose] = await createClient(
        remoteUrl,
        {
            username,
            password,
        },
        proxy,
    );
    try {
        // 尝试列出根目录内容
        // 这是一个无害的 "ping" 操作
        await client.getDirectoryContents("/");

        // 如果成功 (即使是 404)，说明认证和 URL 都通过了
        return true;
    } catch (e: any) {
        if (e.status === 404) {
            // 404 Not Found 是一个有效的响应
            // 它意味着服务器已连接，认证成功，只是目录还未创建
            return true;
        }

        let errorMessage = "Unknown connection error.";
        if (e.status === 401) {
            errorMessage =
                "Authentication failed (401 Unauthorized). Please check username/password or token.";
        } else if (e.message) {
            errorMessage = e.message;
        }

        throw new Error(errorMessage);
    } finally {
        dispose();
    }
};
