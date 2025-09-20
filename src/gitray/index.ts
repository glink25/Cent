import { decode, encode } from "js-base64";
import { sortBy } from "lodash-es";
import { Octokit } from "octokit";
import { transformAssets } from "./assets";
import { shortId } from "./id";
import { Scheduler } from "./scheduler";
import { asyncSingleton } from "./singleton";
import {
    type Action,
    type BaseItem,
    StashBucket,
    type StashStorage,
} from "./stash";

export type OutputType<T> = T;

export type Processor = (finished: Promise<void>) => void;

export type ChangeListener = (args: { store: string }) => void;

export type GitrayConfig = {
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

type GitTreeItem = {
    path?: string;
    mode?: "100644" | "100755" | "040000" | "160000" | "120000";
    type?: "blob" | "tree" | "commit";
    sha?: string | null;
    content?: string;
};

export class Gitray<Item extends BaseItem> {
    protected readonly config: Required<GitrayConfig>;
    private userInfo?: { id: number; login: string };

    constructor(config: GitrayConfig) {
        this.config = {
            repoPrefix: "gitray-db",
            entryName: "entry",
            itemsPerChunk: 1000,
            ...config,
        };
    }

    private async getOctokit(): Promise<Octokit> {
        const { accessToken } = await this.config.auth();
        return new Octokit({ auth: accessToken });
    }

    private async getUserInfo(): Promise<{ id: number; login: string }> {
        if (!this.userInfo) {
            const octokit = await this.getOctokit();
            const { data } = await octokit.request("GET /user");
            this.userInfo = { id: data.id, login: data.login };
        }
        return this.userInfo;
    }

    /**
     * 获取store中所有的collection name
     */
    private async _fetchStoreStructure(
        storeFullName: string,
    ): Promise<StoreStructure> {
        const octokit = await this.getOctokit();
        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);
        const { entryName } = this.config;

        // Step 1: Get ref to the latest commit on the default branch
        const { data: repoData } = await octokit.request(
            "GET /repos/{owner}/{repo}",
            { owner, repo },
        );
        const { data: refData } = await octokit.request(
            "GET /repos/{owner}/{repo}/git/ref/{ref}",
            { owner, repo, ref: `heads/${repoData.default_branch}` },
        );
        const latestCommitSha = refData.object.sha;

        // Step 2: Get the commit to find the root tree SHA
        const { data: commitData } = await octokit.request(
            "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
            { owner, repo, commit_sha: latestCommitSha },
        );
        const treeSha = commitData.tree.sha;

        // Step 3: Get the repo's file tree recursively. This avoids CORS issues with non-existent /contents/ paths.
        const { data: treeData } = await octokit.request(
            "GET /repos/{owner}/{repo}/git/trees/{tree_sha}",
            {
                owner,
                repo,
                tree_sha: treeSha,
                recursive: "true",
            },
        );

        const structure = treeData.tree.reduce(
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
    }
    private fetchStoreStructure = asyncSingleton(
        this._fetchStoreStructure.bind(this),
    );

    private async fetchContentJSON(storeFullName: string, shas: string[]) {
        const [owner, repo] = storeFullName.split("/");
        if ([owner, repo].some((v) => v.length === 0))
            throw new Error(`invalid store name: ${storeFullName}`);
        const octokit = await this.getOctokit();
        return Promise.all(
            shas.map(async (sha) => {
                const { data: content } = await octokit.request(
                    "GET /repos/{owner}/{repo}/git/blobs/{file_sha}",
                    { owner, repo, file_sha: sha },
                );
                return { sha, content: JSON.parse(decode(content.content)) };
            }),
        );
    }

    private async _fetchStoreDetail(
        storeFullName: string,
        _structure?: StoreStructure,
    ) {
        const structure =
            _structure === undefined
                ? await this.fetchStoreStructure(storeFullName)
                : _structure;

        const results = await this.fetchContentJSON(
            storeFullName,
            Array.from(
                new Set([structure.meta, ...structure.chunks].map((v) => v.sha)),
            ),
        );
        const detail = Object.fromEntries(
            Array.from(Object.entries(structure)).map(([k, v]) => {
                if (Array.isArray(v)) {
                    const withContens = v.map((f) => ({
                        ...f,
                        content: results.find((c) => c.sha === f.sha)?.content,
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
        return detail;
    }
    private fetchStoreDetail = asyncSingleton(this._fetchStoreDetail.bind(this));

    /**
     * 获取所有符合repoPrefix的仓库名称
     */
    async fetchAllStore() {
        const octokit = await this.getOctokit();
        const repos = await octokit.paginate("GET /user/repos", { type: "all" });
        return repos
            .filter((repo) => repo.name.startsWith(this.config.repoPrefix))
            .map((repo) => repo.full_name);
    }

    /** 根据名字创建一个store
     * 根据repoPrefix确定store的名称
     * 在本地indexedDB 中创建一个对应名称的
     * 同步在github上创建一个对应名称的repo，并新建一个README.md文件进行仓库初始化
     */
    async createStore(name: string): Promise<{ fullName: string; name: string }> {
        const { login: owner } = await this.getUserInfo();
        const storeName = `${this.config.repoPrefix}-${name}`;
        const octokit = await this.getOctokit();
        await octokit.request("POST /user/repos", {
            name: storeName,
            private: true,
        });
        await octokit.request("PUT /repos/{owner}/{repo}/contents/{path}", {
            owner,
            repo: storeName,
            path: "meta.json",
            message: "Initial commit by Gitray",
            content: encode(JSON.stringify({})),
        });
        return { fullName: `${owner}/${storeName}`, name: storeName };
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
            new StashBucket(storage.createArrayableStorage, storage.createStorage);

        this.storeMap.set(storeFullName, { storage, itemBucket });
        return { itemBucket };
    }
    async initStore(storeFullName: string) {
        const detail = await this.fetchStoreDetail(storeFullName);
        const { itemBucket } = this.getStore(storeFullName);
        const remoteItems = detail.chunks.flatMap((v) => v.content);
        await itemBucket.init(remoteItems, detail.meta.content);
        this.notifyChange(storeFullName);
        return detail;
    }

    async batch(storeFullName: string, actions: Action<Item>[]) {
        const { itemBucket } = this.getStore(storeFullName);
        await itemBucket.batch(actions);
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
        Array.from(this.storeMap.values()).forEach((c) => {
            c.storage.dangerousClearAll();
        });
    }

    private async syncImmediate() {
        return Promise.all(
            Array.from(this.storeMap.entries()).map(
                async ([storeFullName, { itemBucket }]) => {
                    const stashes = await itemBucket.stashStorage.toArray();
                    if (stashes.length === 0) {
                        return;
                    }
                    const octokit = await this.getOctokit();
                    const [owner, repo] = storeFullName.split("/");
                    if ([owner, repo].some((v) => v.length === 0))
                        throw new Error(`invalid store name: ${storeFullName}`);
                    const metaStashes = stashes.filter((v) => v.type === "meta");
                    const itemStashes = stashes.filter((v) => v.type !== "meta");
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
                        const structure = await this.fetchStoreStructure(storeFullName);
                        const sortedChunk = sortBy(structure.chunks, (v) => v.startIndex);
                        const latestChunk = sortedChunk[sortedChunk.length - 1];
                        const [chunkDetail] =
                            latestChunk === undefined
                                ? [undefined]
                                : await this.fetchContentJSON(storeFullName, [latestChunk.sha]);
                        const [transformed, assets] = transformAssets(
                            itemStashes,
                            (file) => {
                                return `https://raw.githubusercontent.com/${owner}/${repo}/main/assets/${shortId()}-${file.name}`;
                            },
                        );
                        const newContent = [
                            ...(chunkDetail?.content ?? []),
                            ...transformed,
                        ];

                        const startIndex = latestChunk?.startIndex ?? 0;
                        const chunks: { file: File; path: string; content: any[] }[] = [];
                        for (
                            let i = 0;
                            i < newContent.length;
                            i += this.config.itemsPerChunk
                        ) {
                            const con = newContent.slice(i, i + this.config.itemsPerChunk);

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
                        return {
                            chunks,
                            assets,
                        };
                    };
                    const [{ chunks, assets }, metas] = await Promise.all([
                        runItemStashesHandler(),
                        runMetaStashesHandler(),
                    ]);

                    const treePayload: GitTreeItem[] = await Promise.all([
                        ...[
                            ...assets.map((v) => {
                                return {
                                    path: v.formattedValue.replace(
                                        `https://raw.githubusercontent.com/${owner}/${repo}/main/`,
                                        "",
                                    ),
                                    file: v.file,
                                };
                            }),
                            ...chunks,
                            ...metas,
                        ].map(async ({ file, path }) => {
                            const base64Content = await blobToBase64(file);
                            const { data: blob } = await octokit.request(
                                "POST /repos/{owner}/{repo}/git/blobs",
                                { owner, repo, content: base64Content, encoding: "base64" },
                            );
                            return {
                                path,
                                mode: "100644" as const,
                                type: "blob" as const,
                                sha: blob.sha,
                            };
                        }),
                        // TODO: remove unused assets
                        // ...deletedPaths.map((path) => {
                        //     return {
                        //         path,
                        //         mode: "100644" as const,
                        //         type: "blob" as const,
                        //         sha: null,
                        //     };
                        // }),
                    ]);
                    const { data: repoData } = await octokit.request(
                        "GET /repos/{owner}/{repo}",
                        { owner, repo },
                    );
                    const { data: refData } = await octokit.request(
                        "GET /repos/{owner}/{repo}/git/ref/{ref}",
                        { owner, repo, ref: `heads/${repoData.default_branch}` },
                    );
                    const { data: commitData } = await octokit.request(
                        "GET /repos/{owner}/{repo}/git/commits/{commit_sha}",
                        { owner, repo, commit_sha: refData.object.sha },
                    );
                    const baseTreeSha = commitData.tree.sha;
                    const latestCommitSha = refData.object.sha;
                    const { data: newTree } = await octokit.request(
                        "POST /repos/{owner}/{repo}/git/trees",
                        { owner, repo, tree: treePayload, base_tree: baseTreeSha },
                    );
                    const { data: newCommit } = await octokit.request(
                        "POST /repos/{owner}/{repo}/git/commits",
                        {
                            owner,
                            repo,
                            message: `[Gitray] Batch update for ${storeFullName}`,
                            tree: newTree.sha,
                            parents: [latestCommitSha],
                        },
                    );
                    await octokit.request("PATCH /repos/{owner}/{repo}/git/refs/{ref}", {
                        owner,
                        repo,
                        ref: `heads/${repoData.default_branch}`,
                        sha: newCommit.sha,
                    });
                    await itemBucket.deleteStashes(...stashes.map((s) => s.id));
                },
            ),
        );
    }

    private syncProcessors: Processor[] = [];
    /**
     * 同步状态处理
     * 当batch被调用后，更新首先会被写入本地
     * 一段时间后，Gitray会自动调用
     * @param processor
     */
    onSync(processor: (finished: Promise<void>) => void) {
        this.syncProcessors.push(processor);
        return () => {
            const i = this.syncProcessors.indexOf(processor);
            this.syncProcessors.splice(i, 1);
        };
    }
    private syncHandler() {
        const finished = this.syncImmediate();
        this.syncProcessors.forEach((p) => {
            p(finished.then());
        });
    }

    private scheduler = new Scheduler(() => this.syncHandler());
    async toSync() {
        this.scheduler.scheduleSync();
    }

    // onChange
    private changeListeners: ChangeListener[] = [];
    private notifyChange(storeFullName: string) {
        this.changeListeners.forEach((p) => {
            p({ store: storeFullName });
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

// Helper function to convert File/Blob to Base64, required for GitHub API
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

export type * from "./stash";

export * from "./storage";
