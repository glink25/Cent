import { decode, encode } from "js-base64";
import { sortBy } from "lodash-es";
import type { ChangeListener, UserInfo } from "@/api/endpoints/type";
import { transformAssets } from "../database/assets";
import { shortId } from "../database/id";
import { Scheduler } from "../database/scheduler";
import { asyncSingleton } from "../database/singleton";
import {
    type Action,
    type BaseItem,
    StashBucket,
    type StashStorage,
} from "../database/stash";

export type Processor = (finished: Promise<void>) => void;

export type GiteerayConfig = {
    /**
     * Dynamically provides authentication tokens. It's called before each API request.
     * 必须具备读写仓库的权限 (repo scope).
     */
    auth: () => Promise<{ accessToken: string; refreshToken?: string }>;
    /**
     * (可选) 用于识别和筛选本 lib 所管理的仓库的统一前缀
     * @default 'gitray-db'
     */
    repoPrefix?: string;

    /**
     * 要操作的集合的名称 (e.g., 'entries', 'posts').
     * 一个客户端实例将专门操作此名称的集合。
     *  @default 'entry'
     */
    entryName?: string;
    itemsPerChunk?: number;
    storage: (storeFullBame: string) => StashStorage;
};

export type FileLike = { path: string; sha: string };

export type FileWithConentLike = { path: string; sha: string; content: any };

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

type Config = {
    structure?: StoreStructure;
};

const treeDateToStructure = (
    tree: {
        path: string;
        mode: string;
        type: string;
        sha: string;
        size?: number;
        url?: string;
    }[],
    entryName: string,
) => {
    const structure = tree.reduce(
        (p, c) => {
            if (c.path === "meta.json") {
                p.meta = c;
            } else if (c.path.startsWith("assets/")) {
                p.assets.push(c);
            }
            // entry-0.json
            else if (
                c.path.startsWith(`${entryName}-`) &&
                c.path.endsWith(`.json`)
            ) {
                const startIndex = Number(
                    c.path.replace(`${entryName}-`, "").replace(".json", ""),
                );
                p.chunks.push({ ...c, startIndex });
            }
            return p;
        },
        {
            chunks: [],
            assets: [],
            meta: { path: "", sha: "", size: 0 },
        } as StoreStructure,
    );
    return structure;
};

type DiffedStructure = {
    meta?: StoreStructure["meta"];
    chunks: StoreStructure["chunks"];
};
const diffStructure = (
    remote: StoreStructure,
    local?: StoreStructure,
): { diff: DiffedStructure; patch: boolean } => {
    if (!local) {
        return { diff: remote, patch: false };
    }
    const diff: DiffedStructure = {
        meta: remote.meta.sha !== local.meta.sha ? remote.meta : undefined,
        chunks: [],
    };
    const diffChunkIndex = remote.chunks.findIndex((c, i) => {
        if (c.sha !== local.chunks[i].sha) {
            return true;
        }
        return false;
    });
    if (diffChunkIndex !== -1) {
        diff.chunks = remote.chunks.slice(diffChunkIndex);
    }

    return { diff, patch: diffChunkIndex !== 0 };
};

export class Giteeray<Item extends BaseItem> {
    protected readonly config: Required<GiteerayConfig>;
    private userInfo?: { id: number; login: string };
    private readonly GITEE_API_BASE = "https://gitee.com/api/v5"; // Gitee OpenAPI v5

    constructor(config: GiteerayConfig) {
        this.config = {
            repoPrefix: "gitray-db",
            entryName: "entry",
            itemsPerChunk: 1000,
            ...config,
        };
    }

    // ----- helper: request to Gitee -----
    private async giteeRequest<T = any>(
        method: string,
        path: string,
        body?: any,
        signal?: AbortSignal,
    ): Promise<T> {
        const { accessToken } = await this.config.auth();
        const url = `${this.GITEE_API_BASE}${path}`;
        const headers: Record<string, string> = {
            Accept: "application/json",
            Authorization: `token ${accessToken}`, // Gitee accepts token in Authorization header
        };
        const opts: RequestInit = {
            method,
            headers,
            signal,
        };
        if (body !== undefined) {
            opts.body = JSON.stringify(body);
            headers["Content-Type"] = "application/json";
        }
        const res = await fetch(url, opts);
        if (!res.ok) {
            const txt = await res.text();
            throw new Error(
                `Gitee API ${method} ${path} failed: ${res.status} ${res.statusText} - ${txt}`,
            );
        }
        // some endpoints return empty body
        const txt = await res.text();
        return txt ? JSON.parse(txt) : ({} as any);
    }

    private async getCurrentUserInfo(): Promise<{ id: number; login: string }> {
        if (!this.userInfo) {
            const data = await this.giteeRequest("GET" as any, "/user"); // trick: we'll call properly next
            // because giteeRequest expects method-first param, but to keep TS types simple, call below explicitly:
        }
        // call properly:
        if (!this.userInfo) {
            const { accessToken } = await this.config.auth();
            const res = await fetch(`${this.GITEE_API_BASE}/user`, {
                headers: { Authorization: `token ${accessToken}` },
            });
            if (!res.ok) throw new Error("Failed to fetch user");
            const data = await res.json();
            this.userInfo = { id: data.id, login: data.login };
        }
        return this.userInfo;
    }

    public async getUserInfo(id?: string) {
        // Gitee: GET /users/{username}
        const { accessToken } = await this.config.auth();
        const path = id ? `/users/${id}` : "/user";
        const res = await fetch(`${this.GITEE_API_BASE}${path}`, {
            headers: { Authorization: `token ${accessToken}` },
        });
        if (!res.ok) throw new Error("Failed to fetch user info from gitee");
        const data = await res.json();
        return {
            avatar_url: data.avatar_url,
            name: data.login,
            id: data.id as unknown as string,
        } as UserInfo;
    }
    public async getCollaborators(id: string) {
        // Gitee: GET /repos/{owner}/{repo}/collaborators
        const { accessToken } = await this.config.auth();
        const [owner, repo] = id.split("/");
        const res = await fetch(
            `${this.GITEE_API_BASE}/repos/${owner}/${repo}/collaborators`,
            { headers: { Authorization: `token ${accessToken}` } },
        );
        if (!res.ok) throw new Error("Failed to fetch collaborators");
        const data = await res.json();
        return data.map((v: any) => ({
            avatar_url: v.avatar_url,
            name: v.login,
            id: v.id as unknown as string,
        })) as UserInfo[];
    }

    public async getOnlineAsset(url: string) {
        // Gitee raw URL pattern: https://gitee.com/{owner}/{repo}/raw/{branch}/{path}
        if (!url.startsWith("https://gitee.com")) {
            return undefined;
        }
        // try direct fetch
        //  `https://gitee.com/${owner}/${repo}/master/assets/${shortId()}-${file.name}`;
        const splitted = url.split("/");
        const owner = splitted[3];
        const repo = splitted[4];
        const path = splitted.slice(6).join("/");
        const { accessToken } = await this.config.auth();
        const headers: Record<string, string> = {
            Accept: "application/json",
            Authorization: `token ${accessToken}`, // Gitee accepts token in Authorization header
        };
        const res = await fetch(
            `https://gitee.com/api/v5/repos/${owner}/${repo}/raw/${path}`,
            {
                headers,
            },
        );
        if (!res.ok) return undefined;
        return res.blob();
    }

    /**
     * 获取store中所有的collection name
     */
    private async _fetchStoreStructure(
        storeFullName: string,
    ): Promise<StoreStructure> {
        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);
        const { entryName } = this.config;

        // 1. get repo info to find default branch
        const repoData = await this.giteeRequest(
            "GET",
            `/repos/${owner}/${repo}`,
        );
        const branch = repoData?.default_branch ?? "master";

        // 2. list root contents
        const rootList = await this.giteeRequest(
            "GET",
            `/repos/${owner}/${repo}/contents?ref=${branch}`,
        );
        // 3. list assets dir if exists
        let assetsList: any[] = [];
        try {
            assetsList = await this.giteeRequest(
                "GET",
                `/repos/${owner}/${repo}/contents/assets?ref=${branch}`,
            );
        } catch {
            assetsList = [];
        }

        // combine list items to a unified tree-like array
        const combined = [
            ...(Array.isArray(rootList) ? rootList : []),
            ...(Array.isArray(assetsList) ? assetsList : []),
        ].map((f: any) => ({
            path: f.path,
            mode: "100644",
            type: f.type,
            sha: f.sha ?? f.sha, // gitee contents returns 'sha'
            size: f.size,
            url: f.url,
        }));

        const structure = treeDateToStructure(combined, entryName);
        return structure;
    }
    private fetchStoreStructure = asyncSingleton(
        this._fetchStoreStructure.bind(this),
    );

    /**
     * Fetch content by file path(s) (uses contents API to read file content base64)
     * Accepts an array of FileLike objects (with .path)
     */
    private async fetchContentJSON(storeFullName: string, files: FileLike[]) {
        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);

        const { accessToken } = await this.config.auth();
        return Promise.all(
            files.map(async (f) => {
                const res = await fetch(
                    `${this.GITEE_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(
                        f.path,
                    )}`,
                    {
                        headers: { Authorization: `token ${accessToken}` },
                    },
                );
                if (!res.ok) {
                    // file not found or other
                    return { sha: f.sha, content: undefined, path: f.path };
                }
                const data = await res.json();
                const content = JSON.parse(decode(data.content));
                return { sha: f.sha, content, path: f.path };
            }),
        );
    }

    private async _fetchStoreDetail(
        storeFullName: string,
        _structure?: StoreStructure,
    ) {
        const remoteStructure =
            _structure === undefined
                ? await this.fetchStoreStructure(storeFullName)
                : _structure;
        const { itemBucket } = this.getStore(storeFullName);
        const localConfig = (await itemBucket.configStorage.getValue()) as
            | Config
            | undefined;
        const localStructure = localConfig?.structure;

        const { diff: structure, patch } = diffStructure(
            remoteStructure,
            localStructure,
        );

        // collect files to fetch (meta + chunks)
        const toFetch: FileLike[] = [
            ...(structure.meta ? [structure.meta] : []),
            ...structure.chunks,
        ] as FileLike[];

        const results = await this.fetchContentJSON(storeFullName, toFetch);
        const detail = Object.fromEntries(
            Array.from(Object.entries(structure))
                .filter(([k, v]) => v !== undefined)
                .map(([k, v]) => {
                    if (Array.isArray(v)) {
                        const withContens = v.map((f) => ({
                            ...f,
                            content: results.find((c) => c.sha === f.sha)
                                ?.content,
                        }));
                        return [k, withContens];
                    }
                    const value = v as FileLike;
                    (value as FileWithConentLike).content = results.find(
                        (c) => c.sha === value.sha,
                    )?.content;
                    return [k, value];
                }),
        ) as StoreDetail;
        return { detail, remote: remoteStructure, patch };
    }
    private fetchStoreDetail = asyncSingleton(
        this._fetchStoreDetail.bind(this),
    );

    /**
     * 获取所有符合repoPrefix的仓库名称
     */
    async fetchAllStore() {
        // Gitee: GET /user/repos
        const repos = await this.giteeRequest("GET", `/user/repos`);
        return (repos as any[])
            .filter((repo) => repo.name.startsWith(this.config.repoPrefix))
            .map((repo) => repo.full_name);
    }

    /** 根据名字创建一个store
     * 根据repoPrefix确定store的名称
     * 在本地indexedDB 中创建一个对应名称的
     * 同步在gitee上创建一个对应名称的repo，并新建一个meta.json文件进行仓库初始化
     */
    async createStore(name: string): Promise<{ id: string; name: string }> {
        const { id: uid, login: owner } = await this.getCurrentUserInfo();
        const storeName = `${this.config.repoPrefix}-${name}`;
        // create repo: POST /user/repos
        await this.giteeRequest("POST", `/user/repos`, {
            name: storeName,
            description: `Created by Giteeray`,
            private: true,
        });
        // create meta.json with empty object
        const { accessToken } = await this.config.auth();
        const path = `/repos/${owner}/${storeName}/contents/meta.json`;
        await fetch(`${this.GITEE_API_BASE}${path}`, {
            method: "POST",
            headers: {
                Authorization: `token ${accessToken}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message: "Initial commit by Giteeray",
                content: encode(JSON.stringify({})),
                branch: "master",
            }),
        });
        return { id: `${owner}/${storeName}`, name: storeName };
    }

    private storeMap = new Map<
        string,
        { storage: StashStorage; itemBucket: StashBucket<Item> }
    >();

    private getStore(storeFullName: string) {
        const storage =
            this.storeMap.get(storeFullName)?.storage ??
            this.config.storage(storeFullName);
        const itemBucket =
            this.storeMap.get(storeFullName)?.itemBucket ??
            new StashBucket(
                storage.createArrayableStorage,
                storage.createStorage,
            );

        this.storeMap.set(storeFullName, { storage, itemBucket });
        return { itemBucket };
    }
    async initStore(storeFullName: string) {
        const { itemBucket } = this.getStore(storeFullName);
        const { detail, remote, patch } =
            await this.fetchStoreDetail(storeFullName);
        const remoteItems = detail.chunks.flatMap((v) => v.content);
        if (patch) {
            await itemBucket.patch(remoteItems, detail.meta?.content);
        } else {
            await itemBucket.init(remoteItems, detail.meta?.content);
        }
        await itemBucket.configStorage.setValue({
            structure: remote,
        });
        this.notifyChange(storeFullName);
        return detail;
    }

    async batch(
        storeFullName: string,
        actions: Action<Item>[],
        overlap = false,
    ) {
        const { itemBucket } = this.getStore(storeFullName);
        await itemBucket.batch(actions, overlap);
        this.notifyChange(storeFullName);
        this.toSync();
    }

    async getAllItems(storeFullName: string) {
        const { itemBucket } = this.getStore(storeFullName);
        const res = await itemBucket.getItems();
        return res ?? [];
    }

    async getMeta(storeFullName: string) {
        const { itemBucket } = this.getStore(storeFullName);
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

    private async syncImmediate(signal?: AbortSignal) {
        return Promise.all(
            Array.from(this.storeMap.entries()).map(
                async ([storeFullName, { itemBucket }]) => {
                    const stashes = await itemBucket.stashStorage.toArray();
                    if (stashes.length === 0) {
                        return;
                    }
                    const isOverlap = Boolean(stashes[0].overlap);
                    const [owner, repo] = storeFullName.split("/");
                    if ([owner, repo].some((v) => v.length === 0))
                        throw new Error(`invalid store name: ${storeFullName}`);
                    const metaStashes = stashes.filter(
                        (v) => v.type === "meta",
                    );
                    const itemStashes = stashes.filter(
                        (v) => v.type !== "meta",
                    );
                    //handle meta
                    const runMetaStashesHandler = async () => {
                        if (metaStashes.length === 0) {
                            return [];
                        }
                        const content = metaStashes[0].metaValue;
                        const file = new File(
                            [new Blob([JSON.stringify(content, null, 2)])],
                            "meta.json",
                        );
                        return [
                            {
                                path: "meta.json",
                                file,
                            },
                        ];
                    };

                    // handle items
                    const runItemStashesHandler = async () => {
                        if (itemStashes.length === 0) {
                            return { chunks: [], assets: [] };
                        }
                        const remoteStructure =
                            await this.fetchStoreStructure(storeFullName);
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
                                : await this.fetchContentJSON(storeFullName, [
                                      latestChunk,
                                  ]);
                        const [transformed, assets] = transformAssets(
                            itemStashes,
                            (file) => {
                                return `https://gitee.com/${owner}/${repo}/master/assets/${shortId()}-${file.name}`;
                            },
                        );
                        const newContent = [
                            ...(chunkDetail?.content ?? []),
                            ...transformed,
                        ];

                        const startIndex = latestChunk?.startIndex ?? 0;
                        const chunks: {
                            file: File | null;
                            path: string;
                            content: any[];
                        }[] = [];
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
                            const file = new File(
                                [new Blob([JSON.stringify(con, null, 2)])],
                                pathToName(path),
                            );
                            chunks.push({
                                file,
                                content: con,
                                path,
                            });
                        }
                        // 如果是overlap，将远端的file全部置空（删除）
                        if (isOverlap) {
                            [
                                ...remoteStructure.chunks,
                                ...remoteStructure.assets,
                            ].forEach((rc) => {
                                if (chunks.some((c) => c.path === rc.path)) {
                                    return;
                                }
                                chunks.push({
                                    file: null,
                                    content: [],
                                    path: rc.path,
                                });
                            });
                        }
                        return {
                            chunks,
                            assets,
                        };
                    };
                    const [{ chunks, assets }, metas] = await Promise.all([
                        runItemStashesHandler(),
                        runMetaStashesHandler(),
                    ]);

                    // Now: for each file (assets + chunk files + meta), perform create/update/delete using Gitee contents API.
                    const { accessToken } = await this.config.auth();
                    // get default branch name
                    const repoData = await this.giteeRequest(
                        "GET",
                        `/repos/${owner}/${repo}`,
                    );
                    const branch = repoData?.default_branch ?? "master";
                    // helper: fetch remote file sha if exists
                    const getRemoteSha = async (path: string) => {
                        const res = await fetch(
                            `${this.GITEE_API_BASE}/repos/${owner}/${repo}/contents/${encodeURIComponent(
                                path,
                            )}?ref=${branch}`,
                            {
                                headers: {
                                    Authorization: `token ${accessToken}`,
                                },
                            },
                        );
                        if (!res.ok) return null;
                        const d = await res.json();
                        return d.sha;
                    };

                    // perform file ops sequentially (could be parallelized if desired)
                    for (const { path, file } of [
                        ...assets.map((v) => ({
                            path: v.formattedValue.replace(
                                `https://gitee.com/${owner}/${repo}/master/`,
                                "",
                            ),
                            file: v.file,
                        })),
                        ...chunks.map((c) => ({ path: c.path, file: c.file })),
                        ...metas.map((m: any) => ({
                            path: m.path,
                            file: m.file,
                        })),
                    ]) {
                        const remoteSha = await getRemoteSha(path);
                        if (file === null) {
                            // delete
                            if (remoteSha) {
                                await this.giteeRequest(
                                    "DELETE",
                                    `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
                                    {
                                        message: `[Giteeray] Delete ${path}`,
                                        sha: remoteSha,
                                        branch,
                                    },
                                );
                            }
                            continue;
                        }
                        const base64 = await blobToBase64(file);
                        const body = {
                            message: `[Giteeray] Update ${storeFullName}`,
                            content: base64,
                            branch,
                        };
                        if (!remoteSha) {
                            // create
                            await this.giteeRequest(
                                "POST",
                                `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
                                {
                                    ...body,
                                },
                            );
                        } else {
                            // update
                            await this.giteeRequest(
                                "PUT",
                                `/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`,
                                {
                                    ...body,
                                    sha: remoteSha,
                                },
                            );
                        }
                    }

                    // after ops, refresh structure and store config
                    const newStructure =
                        await this.fetchStoreStructure(storeFullName);
                    await itemBucket.configStorage.setValue({
                        structure: newStructure,
                    });
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

    // onChange
    private changeListeners: ChangeListener[] = [];
    private notifyChange(storeFullName: string) {
        this.changeListeners.forEach((p) => {
            p({ bookId: storeFullName });
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

const pathToName = (path: string) => {
    const splitted = path.split("/");
    return splitted[splitted.length - 1];
};

// Helper function to convert File/Blob to Base64, required for Gitee API
async function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64 = dataUrl.split(",")[1];
            resolve(base64);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(blob);
    });
}
