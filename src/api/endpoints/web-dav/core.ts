import { sortBy } from "lodash-es";
import type { FileStat, WebDAVClient, WebDAVClientOptions } from "webdav";

import type { ChangeListener } from "@/api/endpoints/type";
import { transformAssets } from "@/database/assets";
import { shortId } from "@/database/id";
import { Scheduler } from "@/database/scheduler";
import { asyncSingleton } from "@/database/singleton";
import {
    type Action,
    type BaseItem,
    StashBucket,
    type StashStorage,
} from "@/database/stash";
import { registerProxy } from "@/utils/fetch-proxy";

const createClient = async (
    remoteURL: string,
    options: WebDAVClientOptions,
    proxy?: string,
) => {
    const lib = await import("webdav");
    const dispose = registerProxy(async (url, options, next) => {
        if (!proxy) {
            return next(url, options);
        }

        const urlStr = typeof url === "string" ? url : url.toString();

        // 检查是否匹配 remoteURL
        const isMatch = urlStr.startsWith(remoteURL);
        if (!isMatch) return next(url, options);

        // 构造代理 URL
        const proxyUrl = new URL(proxy);
        const hasMethodParam = [...proxyUrl.searchParams.keys()].includes(
            "method",
        );

        // 将原始 URL 作为参数传递
        proxyUrl.searchParams.set("url", urlStr);

        // 如果 proxy 中包含 method 参数占位，则改为 POST 并附带真实 method
        const originalMethod = (options.method || "GET").toUpperCase();
        if (hasMethodParam && originalMethod !== "POST") {
            proxyUrl.searchParams.set("method", originalMethod);
            options = {
                ...options,
                method: "POST",
            };
        }

        const newUrl = proxyUrl.toString();
        console.log(
            `[fetch-proxy] redirecting: ${originalMethod} ${urlStr} → POST ${newUrl}`,
        );

        return next(newUrl, options);
    });
    return [lib.createClient(remoteURL, options), dispose] as const;
};

export type Processor = (finished: Promise<void>) => void;

// GitrayConfig -> WebdavSyncConfig
export type WebDAVSyncConfig = {
    /**
     * WebDAV 服务器的完整 URL
     */
    remoteUrl: string;
    username: string;
    password: string;
    proxy: string | undefined;
    customUserName: string | undefined;
    /**
     * (可选) 用于所有 store 的根目录
     * @default 'webdav-db'
     */
    baseDir?: string;
    repoPrefix: string;
    /**
     * 要操作的集合的名称 (e.g., 'entries', 'posts').
     * @default 'entry'
     */
    entryName?: string;
    itemsPerChunk?: number;
    storage: (storeFullBame: string) => StashStorage;
};

// FileLike: sha -> etag, lastmod
export type FileLike = {
    path: string;
    etag: string | null;
    lastmod: string;
    size: number;
};

export type FileWithConentLike = FileLike & { content: any };

export type Meta = { [key: string]: any };

export type StoreStructure = {
    chunks: (FileLike & { startIndex: number })[];
    meta: FileLike;
    assets: FileLike[];
};

export type StoreDetail = {
    chunks: (FileWithConentLike & { startIndex: number; endIndex: number })[];
    meta: FileWithConentLike;
    assets: FileLike[];
};

// 移除 GitTreeItem

type Config = {
    structure?: StoreStructure;
};

type WebDAVPrivateMeta = {
    _webDAVUserAliases?: string[];
};

// treeDateToStructure -> fileStatsToStructure
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
    const structure: StoreStructure = {
        chunks: [],
        assets: [],
        meta: { path: "", etag: null, lastmod: "", size: 0 },
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
                etag: file.etag ?? null,
                lastmod: file.lastmod,
                size: file.size,
            };
        } else if (relativePath.startsWith("assets/")) {
            structure.assets.push({
                path: relativePath,
                ...file,
                etag: file.etag ?? null,
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
                etag: file.etag ?? null,
                startIndex,
            });
        }
    }
    return structure;
};

type DiffedStructure = {
    meta?: StoreStructure["meta"];
    chunks: StoreStructure["chunks"];
};

// diffStructure: sha -> etag
const diffStructure = (
    remote: StoreStructure,
    local?: StoreStructure,
): { diff: DiffedStructure; patch: boolean } => {
    if (!local) {
        return { diff: remote, patch: false };
    }

    // 必须排序以进行正确比较
    const sortedRemoteChunks = sortBy(remote.chunks, "startIndex");
    const sortedLocalChunks = sortBy(local?.chunks ?? [], "startIndex");

    const diff: DiffedStructure = {
        meta: remote.meta.etag !== local.meta.etag ? remote.meta : undefined,
        chunks: [],
    };

    const diffChunkIndex = sortedRemoteChunks.findIndex((c, i) => {
        // 如果本地 chunk 不存在，或者 etag 不匹配，则认为有差异
        if (!sortedLocalChunks[i] || c.etag !== sortedLocalChunks[i].etag) {
            return true;
        }
        return false;
    });

    if (diffChunkIndex !== -1) {
        // 从第一个差异开始，获取所有后续 chunk
        diff.chunks = sortedRemoteChunks.slice(diffChunkIndex);
    }

    return { diff, patch: diffChunkIndex !== 0 };
};

/**
 * 🐌 串行执行 (Serial Execution)
 * - 每次只执行一个 Promise。
 * - 整体执行时间是所有 Promise 执行时间的总和。
 * - 只要有一个 Promise 拒绝，则立即拒绝（Fail-Fast，与 Promise.all 行为一致）。
 */
export const promiseAll = async <T, R>(
    array: T[],
    map: (v: T, index: number, array: T[]) => Promise<R> | R,
): Promise<R[]> => {
    const results: R[] = [];

    // 使用 for...of 循环确保每次迭代（即 map(v)）是串行等待的
    for (let i = 0; i < array.length; i++) {
        const value = array[i];
        try {
            // await 会暂停循环，直到当前的 Promise 完成
            const result = await map(value, i, array);
            results.push(result);
        } catch (e) {
            // 实现 Promise.all 的 Fail-Fast 行为：如果任何一个 Promise 拒绝，则抛出错误
            throw e;
        }
    }

    return results;
};

// Gitray -> WebDAVSync
export class WebDAVSync<Item extends BaseItem> {
    protected readonly config: Required<WebDAVSyncConfig>;
    // private userInfo?: { id: number; login: string }; // 移除 GitHub user info
    private clientInstance?: WebDAVClient; // Octokit -> WebDAVClient

    constructor(config: WebDAVSyncConfig) {
        this.config = {
            baseDir: "cent",
            entryName: "entry",
            itemsPerChunk: 1000,
            ...config,
        };
        // 确保 baseDir 不以 / 结尾
        if (this.config.baseDir.endsWith("/")) {
            this.config.baseDir = this.config.baseDir.slice(0, -1);
        }
    }

    /**
     * 检查 WebDAV 配置是否有效
     * 它会尝试连接并列出 baseDir 的内容
     * @returns Promise<{ valid: boolean; error?: string }>
     */
    static async checkConfig(
        config: Pick<
            WebDAVSyncConfig,
            "username" | "password" | "remoteUrl" | "proxy"
        >,
    ) {
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
    }

    // getOctokit -> getWebdavClient
    private async getWebdavClient(): Promise<WebDAVClient> {
        if (this.clientInstance) {
            return this.clientInstance;
        }
        const { remoteUrl, username, password, proxy } = this.config;
        const [client] = await createClient(
            remoteUrl,
            {
                username,
                password,
            },
            proxy,
        );
        this.clientInstance = client;
        return client;
    }

    public async getUserAliases(storeName: string) {
        const { itemBucket } = this.getStore(storeName);
        const meta: WebDAVPrivateMeta | undefined = await itemBucket.getMeta();
        if (!meta?._webDAVUserAliases) {
            return [];
        }
        return meta._webDAVUserAliases;
    }

    // getOnlineAsset: 改为从 WebDAV 获取
    public async getOnlineAsset(url: string) {
        // 从 URL 中提取路径
        const path = url;

        try {
            const client = await this.getWebdavClient();
            const blob = (await client.getFileContents(path, {
                format: "binary",
            })) as unknown as Blob;
            return blob;
        } catch (e) {
            console.error(`getOnlineAsset failed for path ${path}:`, e);
            return undefined;
        }
    }

    /**
     * 获取 store 中所有的 collection name
     */
    // _fetchStoreStructure: Octokit -> WebDAV
    private async _fetchStoreStructure(
        storeName: string, // storeFullName -> storeName
    ): Promise<StoreStructure> {
        const client = await this.getWebdavClient();
        const { entryName, baseDir } = this.config;
        const storePath = `${baseDir}/${storeName}`;

        try {
            // 递归获取所有文件
            const files = (await client.getDirectoryContents(storePath, {
                deep: true,
            })) as FileStat[];

            // 解析文件列表
            return fileStatsToStructure(files, entryName, storePath);
        } catch (e: any) {
            if (e.status === 404) {
                // 目录不存在，返回空结构
                return {
                    chunks: [],
                    assets: [],
                    meta: { path: "", etag: null, lastmod: "", size: 0 },
                };
            }
            throw e; // 抛出其他错误
        }
    }
    private fetchStoreStructure = asyncSingleton(
        this._fetchStoreStructure.bind(this),
    );

    /** 部分Web DAV存在接口并发限制，因此改为串行执行 */
    private async fetchContentJSON(storeName: string, files: FileLike[]) {
        const client = await this.getWebdavClient();
        const { baseDir } = this.config;
        const storePath = `${baseDir}/${storeName}`;

        // 存储结果的数组
        const results = [];

        // 使用 for...of 循环确保对 files 列表中的每一项操作是串行（非并发）的
        for (const file of files) {
            const filePath = `${storePath}/${file.path}`;
            try {
                const content = (await client.getFileContents(filePath, {
                    format: "text",
                })) as string;

                // 返回 FileWithConentLike 结构，并加入结果数组
                results.push({ ...file, content: JSON.parse(content) });
            } catch (e) {
                console.error(`Failed to fetch ${filePath}:`, e);
                // 处理文件读取失败，并加入结果数组
                results.push({ ...file, content: undefined });
            }
        }

        return results;
    }

    // _fetchStoreDetail: 调整以适应新的 fetchContentJSON
    private async _fetchStoreDetail(
        storeName: string, // storeFullName -> storeName
        _structure?: StoreStructure,
    ) {
        const remoteStructure =
            _structure === undefined
                ? await this.fetchStoreStructure(storeName)
                : _structure;

        const { itemBucket } = this.getStore(storeName);
        const localConfig = (await itemBucket.configStorage.getValue()) as
            | Config
            | undefined;
        const localStructure = localConfig?.structure;

        const { diff: structure, patch } = diffStructure(
            remoteStructure,
            localStructure,
        );

        // 找到所有需要获取内容的文件
        const filesToFetch: FileLike[] = [
            ...(structure.meta ? [structure.meta] : []),
            ...structure.chunks,
        ].filter((v) => v.path); // 过滤掉空的 meta

        // 获取文件内容
        const results = await this.fetchContentJSON(storeName, filesToFetch);

        // 重新构建 StoreDetail
        const detail: StoreDetail = {
            chunks: [],
            meta: (results.find(
                (r) => r.path === structure.meta?.path,
            ) as FileWithConentLike) || {
                path: "",
                etag: null,
                lastmod: "",
                size: 0,
                content: undefined,
            },
            assets: remoteStructure.assets, // assets 结构只传递，不获取内容
        };

        const entryName = this.config.entryName;

        detail.chunks = results
            .filter((r) => r.path !== structure.meta?.path) // 过滤掉 meta
            .map((r) => {
                const startIndex = Number(
                    r.path.replace(`${entryName}-`, "").replace(".json", ""),
                );
                return { ...r, endIndex: 0, startIndex };
            }); // endIndex 似乎未使用，保持 0

        return { detail, remote: remoteStructure, patch };
    }
    private fetchStoreDetail = asyncSingleton(
        this._fetchStoreDetail.bind(this),
    );

    /**
     * 获取所有符合 baseDir 的 store
     */
    // fetchAllStore: Octokit -> WebDAV
    async fetchAllStore() {
        const client = await this.getWebdavClient();
        const { baseDir, repoPrefix } = this.config;
        try {
            const contents = (await client.getDirectoryContents(
                baseDir!,
            )) as FileStat[];
            return contents
                .filter(
                    (item) =>
                        item.type === "directory" &&
                        item.basename.startsWith(repoPrefix), // repoPrefix 仍然用于过滤
                )
                .map((item) => item.basename); // 返回目录名，例如 'gitray-db-my-store'
        } catch (e: any) {
            if (e.status === 404) {
                return []; // 根目录不存在
            }
            throw e;
        }
    }

    /** 根据名字创建一个store
     * 在 WebDAV 上创建一个对应的目录，并初始化 meta.json 和 assets 目录
     */
    // createStore: Octokit -> WebDAV
    async createStore(name: string): Promise<{ id: string; name: string }> {
        const client = await this.getWebdavClient();
        const storeName = `${this.config.repoPrefix}-${name}`; // 仍然使用 repoPrefix 命名
        const storePath = `${this.config.baseDir}/${storeName}`;

        await client.createDirectory(storePath, { recursive: true });
        // 初始化 meta.json
        await client.putFileContents(
            `${storePath}/meta.json`,
            JSON.stringify({}),
        );
        // 创建 assets 目录
        await client.createDirectory(`${storePath}/assets`);

        return { id: storeName, name: storeName }; // id 现在只是 store 目录名
    }

    /**
     * 删除一个账本 (store)
     * 这将删除 WebDAV 上的整个目录，并清除本地 IndexedDB 中的所有相关数据
     * @param storeName 账本的名称 (例如 'cent-journal-123')
     */
    async deleteStore(storeName: string): Promise<void> {
        // 1. 从 WebDAV 服务器删除
        try {
            const client = await this.getWebdavClient();
            const storePath = `${this.config.baseDir}/${storeName}`;
            await client.deleteFile(storePath); // webdav-js 使用 deleteFile 删除目录
        } catch (e: any) {
            if (e.status === 404) {
                // 目录已经不存在，可以忽略
                console.log(
                    `Store directory ${storeName} not found on remote. Skipping remote deletion.`,
                );
            } else {
                console.error(`Failed to delete remote store ${storeName}:`, e);
                throw new Error(`Failed to delete remote store: ${e.message}`);
            }
        }

        // 2. 从本地删除
        if (this.storeMap.has(storeName)) {
            const { storage, itemBucket } = this.getStore(storeName);

            // 清除 IndexedDB 数据
            await storage.dangerousClearAll();

            // 从内存中的 map 移除
            this.storeMap.delete(storeName);
        } else {
            // 如果不在 map 中 (例如从未初始化过)，也尝试清除一下
            const storage = this.config.storage(storeName);
            await storage.dangerousClearAll();
        }

        // (可选) 触发一个变更通知，告知账本被删除
        // this.notifyChange(storeName); // 取决于你的应用逻辑是否需要处理
        console.log(`Successfully deleted store: ${storeName}`);
    }

    private storeMap = new Map<
        string,
        { storage: StashStorage; itemBucket: StashBucket<Item> }
    >();

    // getStore: storeFullName -> storeName
    private getStore(storeName: string) {
        const storage =
            this.storeMap.get(storeName)?.storage ??
            this.config.storage(storeName);
        const itemBucket =
            this.storeMap.get(storeName)?.itemBucket ??
            new StashBucket(
                storage.createArrayableStorage,
                storage.createStorage,
            );

        this.storeMap.set(storeName, { storage, itemBucket });
        return { itemBucket, storage };
    }

    // initStore: storeFullName -> storeName
    async initStore(storeName: string) {
        const { itemBucket } = this.getStore(storeName);
        const { detail, remote, patch } =
            await this.fetchStoreDetail(storeName);
        const remoteItems = detail.chunks
            .flatMap((v) => v.content)
            .filter(Boolean); // 过滤 null content
        if (patch) {
            await itemBucket.patch(remoteItems, detail.meta?.content);
        } else {
            await itemBucket.init(remoteItems, detail.meta?.content);
        }
        await itemBucket.configStorage.setValue({
            structure: remote,
        });
        //
        itemBucket.getMeta().then((meta?: WebDAVPrivateMeta) => {
            const customUserName = this.config.customUserName;
            if (!customUserName) {
                return;
            }
            if (!meta?._webDAVUserAliases?.includes(customUserName)) {
                const newMeta = meta ?? {};
                newMeta._webDAVUserAliases = [
                    ...(meta?._webDAVUserAliases ?? []),
                    customUserName,
                ];
                itemBucket.batch([
                    {
                        type: "meta",
                        metaValue: newMeta,
                    },
                ]);
            }
        });
        this.notifyChange(storeName);
        return detail;
    }

    // batch: storeFullName -> storeName
    async batch(storeName: string, actions: Action<Item>[], overlap = false) {
        const { itemBucket } = this.getStore(storeName);
        await itemBucket.batch(actions, overlap);
        this.notifyChange(storeName);
        this.toSync();
    }

    // getAllItems: storeFullName -> storeName
    async getAllItems(storeName: string) {
        const { itemBucket } = this.getStore(storeName);
        const res = await itemBucket.getItems();
        return res ?? [];
    }

    // getMeta: storeFullName -> storeName
    async getMeta(storeName: string) {
        const { itemBucket } = this.getStore(storeName);
        const res = (await itemBucket.getMeta()) ?? {};
        return res;
    }

    async getIsNeedSync() {
        const somes = await Promise.all(
            Array.from(this.storeMap.values()).map(async ({ itemBucket }) => {
                const items = await itemBucket.stashStorage.toArray();
                return items.length > 0;
            }),
        );
        return somes.some((v) => v);
    }

    dangerousClearAll() {
        return Promise.all(
            Array.from(this.storeMap.values()).map((c) => {
                return c.storage.dangerousClearAll();
            }),
        );
    }

    // syncImmediate: 核心重写 (Octokit -> WebDAV)
    private async syncImmediate(signal?: AbortSignal) {
        return Promise.all(
            Array.from(this.storeMap.entries()).map(
                async ([storeName, { itemBucket }]) => {
                    // storeFullName -> storeName
                    const stashes = await itemBucket.stashStorage.toArray();
                    if (stashes.length === 0) {
                        return;
                    }
                    if (signal?.aborted) return;

                    const isOverlap = Boolean(stashes[0].overlap);
                    const client = await this.getWebdavClient();
                    const { baseDir } = this.config;
                    const storePath = `${baseDir}/${storeName}`; // e.g., /webdav-db/my-store

                    const metaStashes = stashes.filter(
                        (v) => v.type === "meta",
                    );
                    const itemStashes = stashes.filter(
                        (v) => v.type !== "meta",
                    );

                    // --- 准备 Meta 上传 ---
                    const metaUploads: { path: string; content: string }[] = [];
                    if (metaStashes.length > 0) {
                        const content = metaStashes[0].metaValue;
                        metaUploads.push({
                            path: "meta.json",
                            content: JSON.stringify(content, null, 2),
                        });
                    }

                    // --- 准备 Items 和 Assets 上传 ---
                    let itemUploads: { path: string; content: string }[] = [];
                    let assetsUploads: { path: string; file: File }[] = [];
                    const filesToDelete: string[] = []; // WebDAV 需要显式删除

                    if (itemStashes.length > 0) {
                        const remoteStructure =
                            await this.fetchStoreStructure(storeName);

                        // Abort check
                        if (signal?.aborted) return;

                        const structure = isOverlap
                            ? {
                                  chunks: [],
                                  assets: [],
                                  meta: remoteStructure.meta,
                              }
                            : remoteStructure;

                        const sortedChunk = sortBy(
                            structure.chunks,
                            (v) => v.startIndex,
                        );
                        const latestChunk = sortedChunk[sortedChunk.length - 1];

                        const [chunkDetail] =
                            latestChunk === undefined
                                ? [undefined]
                                : await this.fetchContentJSON(storeName, [
                                      latestChunk,
                                  ]);

                        // Abort check
                        if (signal?.aborted) return;

                        // 更改 Assets URL 生成逻辑
                        const [transformed, assets] = transformAssets(
                            itemStashes,
                            (file) => {
                                const assetPath = `assets/${shortId()}-${file.name}`;
                                return `${storePath}/${assetPath}`;
                            },
                        );

                        // 准备 Assets 上传
                        assetsUploads = assets.map((a) => {
                            // 从 URL 反向解析出相对路径
                            const relativePath = a.formattedValue
                                .replace(storePath.replace(/^\//, ""), "")
                                .replace(/^\//, "");
                            return {
                                path: relativePath,
                                file: a.file,
                            };
                        });

                        const newContent = [
                            ...(chunkDetail?.content ?? []),
                            ...transformed,
                        ];

                        const startIndex = latestChunk?.startIndex ?? 0;
                        const chunks: { path: string; content: string }[] = [];
                        for (
                            let i = 0;
                            i < newContent.length;
                            i += this.config.itemsPerChunk
                        ) {
                            const con = newContent.slice(
                                i,
                                i + this.config.itemsPerChunk,
                            );
                            const path = `${this.config.entryName}-${i + startIndex}.json`;
                            chunks.push({
                                content: JSON.stringify(con, null, 2),
                                path,
                            });
                        }
                        itemUploads = chunks;

                        // 如果是 overlap，计算需要删除的远程文件
                        if (isOverlap) {
                            [
                                ...remoteStructure.chunks,
                                ...remoteStructure.assets,
                            ].forEach((rc) => {
                                // 检查这个文件是否在新的上传列表中
                                const isOverwritten =
                                    itemUploads.some(
                                        (u) => u.path === rc.path,
                                    ) ||
                                    assetsUploads.some(
                                        (u) => u.path === rc.path,
                                    );

                                if (!isOverwritten) {
                                    filesToDelete.push(rc.path);
                                }
                            });
                        }
                    }

                    // --- 1. 执行删除 ---
                    await promiseAll(filesToDelete, (path) => {
                        if (signal?.aborted) return;
                        return client
                            .deleteFile(`${storePath}/${path}`)
                            .catch((e) =>
                                console.error(`Failed to delete ${path}`, e),
                            ); // 容错
                    });

                    if (signal?.aborted) return;

                    // --- 2. 执行上传 ---
                    const allTextUploads = [...itemUploads, ...metaUploads];

                    // 上传文本文件 (JSON)
                    await promiseAll(
                        allTextUploads,
                        async ({ path, content }) => {
                            if (signal?.aborted) return;
                            const fullPath = `${storePath}/${path}`;
                            await client.putFileContents(fullPath, content);
                        },
                    );

                    if (signal?.aborted) return;

                    // 上传二进制文件 (Assets)
                    await promiseAll(assetsUploads, async ({ path, file }) => {
                        if (signal?.aborted) return;
                        const fullPath = `${storePath}/${path}`;
                        // 确保 assets 目录存在
                        await client.createDirectory(`${storePath}/assets`, {
                            recursive: true,
                        });
                        // file (Blob) -> ArrayBuffer
                        const content = await file.arrayBuffer();
                        await client.putFileContents(fullPath, content);
                    });

                    if (signal?.aborted) return;

                    // --- 3. 更新本地 structure ---
                    // 上传后，ETag 已变更，重新获取最新的 store 结构
                    const newRemoteStructure =
                        await this._fetchStoreStructure(storeName);
                    await itemBucket.configStorage.setValue({
                        structure: newRemoteStructure,
                    });

                    // --- 4. 清理 Stash ---
                    await itemBucket.deleteStashes(...stashes.map((s) => s.id));
                },
            ),
        );
    }

    private scheduler = new Scheduler(async (signal) => {
        await this.syncImmediate(signal);
    });

    onSync(processor: (finished: Promise<void>) => void) {
        return this.scheduler.onProcess(processor);
    }

    async toSync() {
        this.scheduler.schedule();
    }

    // onChange: storeFullName -> storeName
    private changeListeners: ChangeListener[] = [];
    private notifyChange(storeName: string) {
        this.changeListeners.forEach((p) => {
            p({ bookId: storeName });
        });
    }
    /**
     * 监听数据是否发生变化
     */
    onChange(listener: ChangeListener) {
        this.changeListeners.push(listener);
        return () => {
            const i = this.changeListeners.indexOf(listener);
            this.changeListeners.splice(i, 1);
        };
    }
}
