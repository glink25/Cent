// tidal/index.ts
import { sortBy } from "lodash-es";
import type { ChangeListener, UserInfo } from "@/api/endpoints/type";
import { type FileEntry, transformAssets } from "@/database/assets";
import { asyncSingleton } from "@/database/singleton";
import {
    type Action,
    type BaseItem,
    mergeMeta,
    StashBucket,
    type StashStorage,
} from "@/database/stash";

export type AssetKey = string;

export type FileLike = { path: string; sha: string };
export type FileWithContent = { path: string; sha: string; content: any };

export type StoreStructure<F = FileLike> = {
    chunks: (F & { startIndex: number })[];
    meta: F;
    assets: F[];
};

export type StoreDetail = {
    chunks: (FileWithContent & { startIndex: number; endIndex: number })[];
    meta: FileWithContent;
    assets: FileLike[];
};

export type Syncer = {
    fetchStructure: (storeFullName: string) => Promise<StoreStructure>;
    fetchContent: (
        storeFullName: string,
        paths: FileLike[],
    ) => Promise<FileWithContent[]>;
    uploadContent: (
        storeFullName: string,
        files: {
            path: string;
            content: string | undefined;
        }[],
    ) => Promise<StoreStructure>;
    transformAsset: (file: File, storeFullName: string) => AssetKey;
    createStore: (name: string) => Promise<{ id: string; name: string }>;

    getAsset: (fileKey: AssetKey, storeFullName: string) => Promise<Blob>;
    assetEntryToPath: (
        entry: FileEntry<string>,
        storeFullName: string,
    ) => string;
    getUserInfo: (id?: string) => Promise<UserInfo>;
    getCollaborators: (id: string) => Promise<UserInfo[]>;
    fetchAllStore: () => Promise<string[]>;
};

type Config = {
    structure?: StoreStructure;
};
/**
 * createTidal
 *
 * storageFactory: (storeFullName) => StashStorage
 * syncerFactory: () => Syncer
 * options: itemsPerChunk, entryName
 */
export const createTidal = <Item extends BaseItem>({
    storageFactory,
    syncerFactory,
    itemsPerChunk = 1000,
    entryName = "entry",
}: {
    storageFactory: (storeFullName: string) => StashStorage;
    syncerFactory: () => Syncer;
    itemsPerChunk?: number;
    entryName?: string;
}) => {
    const storeMap = new Map<
        string,
        { storage: StashStorage; itemBucket: StashBucket<Item> }
    >();

    // onChange
    const changeListeners: ChangeListener[] = [];
    const notifyChange = (storeFullName: string) => {
        changeListeners.forEach((p) => {
            p({ bookId: storeFullName });
        });
    };
    /**
     * 监听数据是否发生变化
     */
    const onChange = (listener: ChangeListener) => {
        changeListeners.push(listener);
        return () => {
            const i = changeListeners.indexOf(listener);
            changeListeners.splice(i, 1);
        };
    };

    const getSyncer = (() => {
        let syncer: Syncer | undefined;
        return () => {
            if (!syncer) {
                syncer = syncerFactory();
            }
            return syncer;
        };
    })();

    const getStore = (storeFullName: string) => {
        const storage =
            storeMap.get(storeFullName)?.storage ??
            storageFactory(storeFullName);
        const itemBucket =
            storeMap.get(storeFullName)?.itemBucket ??
            new StashBucket(
                storage.createArrayableStorage,
                storage.createStorage,
            );
        storeMap.set(storeFullName, { storage, itemBucket });
        return { storage, itemBucket };
    };

    // fetch structure singleton (to avoid many calls)
    const _fetchStructure = async (storeFullName: string) => {
        const syncer = getSyncer();
        return await syncer.fetchStructure(storeFullName);
    };
    const fetchStructure = asyncSingleton(_fetchStructure);

    const fetchContent = async (storeFullName: string, files: FileLike[]) => {
        const syncer = getSyncer();
        return await syncer.fetchContent(storeFullName, files);
    };

    const fetchStoreDetail = async (
        storeFullName: string,
        _structure?: StoreStructure,
    ) => {
        const remoteStructure =
            _structure === undefined
                ? await fetchStructure(storeFullName)
                : _structure;
        const { itemBucket } = getStore(storeFullName);
        const localConfig = (await itemBucket.configStorage.getValue()) as
            | Config
            | undefined;
        const localStructure = localConfig?.structure;

        const { diff: structure, patch } = diffStructure(
            remoteStructure,
            localStructure,
        );
        const results = await fetchContent(
            storeFullName,
            Array.from(
                new Set(
                    [structure.meta, ...structure.chunks].filter(
                        (v) => v !== undefined,
                    ),
                ),
            ),
        );
        const detail = Object.fromEntries(
            Array.from(Object.entries(structure))
                .filter(([k, v]) => v !== undefined)
                .map(([k, v]) => {
                    if (Array.isArray(v)) {
                        const withContents = v.map((f) => ({
                            ...f,
                            content: results.find((c) => c.sha === f.sha)
                                ?.content,
                        }));
                        return [k, withContents];
                    }
                    const value = v as FileLike;
                    (value as any).content = results.find(
                        (c) => c.sha === value.sha,
                    )?.content;
                    return [k, value];
                }),
        ) as StoreDetail;
        return { detail, remote: remoteStructure, patch };
    };

    // init single store: pull remote structure+content -> patch/init local stash
    const init = async (storeFullName: string) => {
        const { itemBucket } = getStore(storeFullName);

        const { detail, remote, patch } = await fetchStoreDetail(storeFullName);
        const remoteItems = detail.chunks.flatMap((v) => v.content);
        if (patch) {
            await itemBucket.patch(remoteItems, detail.meta?.content);
        } else {
            await itemBucket.init(remoteItems, detail.meta?.content);
        }
        await itemBucket.configStorage.setValue({
            structure: remote,
        });
        notifyChange(storeFullName);
    };

    const create = async (name: string) => {
        const syncer = getSyncer();
        return await syncer.createStore(name);
    };

    const getAllItems = async (storeFullName: string) => {
        const { itemBucket } = getStore(storeFullName);
        const res = await itemBucket.getItems();
        return res ?? [];
    };

    const getMeta = async (storeFullName: string) => {
        const { itemBucket } = getStore(storeFullName);
        const res = (await itemBucket.getMeta()) ?? {};
        return res;
    };

    const batch = async (
        storeFullName: string,
        actions: Action<Item>[],
        overlap = false,
    ) => {
        const { itemBucket } = getStore(storeFullName);
        await itemBucket.batch(actions, overlap);
        notifyChange(storeFullName);
        // schedule sync immediately (we'll not use scheduler; user can call sync())
    };

    // core syncImmediate implementation (single run; supports abort)
    const syncImmediate = async (signal?: AbortSignal) => {
        const syncer = getSyncer();
        return Promise.all(
            Array.from(storeMap.entries()).map(
                async ([storeFullName, { itemBucket }]) => {
                    const stashes = await itemBucket.stashStorage.toArray();
                    if (stashes.length === 0) {
                        return;
                    }
                    const isOverlap = Boolean(stashes[0].overlap);
                    // separate meta and item stashes
                    const metaStashes = stashes.filter(
                        (v) => v.type === "meta",
                    );
                    const itemStashes = stashes.filter(
                        (v) => v.type !== "meta",
                    );

                    const getRemoteStructure = (() => {
                        let struct: ReturnType<typeof fetchStructure>;
                        return () => {
                            if (!struct) {
                                struct = fetchStructure(storeFullName);
                            }
                            return struct;
                        };
                    })();

                    // meta handler
                    const runMetaStashesHandler = async () => {
                        if (metaStashes.length === 0) return [];
                        const remoteStructure = await getRemoteStructure();
                        const [remoteMeta] = await fetchContent(storeFullName, [
                            remoteStructure.meta,
                        ]);
                        const content = mergeMeta(
                            remoteMeta.content,
                            metaStashes[0].metaValue,
                        );
                        return [
                            {
                                path: "meta.json",
                                content,
                            },
                        ];
                    };

                    // items handler
                    const runItemStashesHandler = async () => {
                        if (itemStashes.length === 0) {
                            return { chunks: [], assets: [] };
                        }

                        const remoteStructure = await getRemoteStructure();
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
                        const latestChunkContent = latestChunk
                            ? (
                                  await fetchContent(storeFullName, [
                                      latestChunk,
                                  ])
                              )[0]
                            : undefined;

                        // transform assets: use syncer.transformAsset
                        const [transformed, assets] = transformAssets(
                            itemStashes,
                            (file: File) =>
                                syncer.transformAsset(file, storeFullName),
                        );

                        const newContent = [
                            ...(latestChunkContent?.content ?? []),
                            ...transformed,
                        ];

                        const startIndex = latestChunk?.startIndex ?? 0;
                        const chunks: {
                            path: string;
                            content: any | null;
                            sha?: string;
                        }[] = [];
                        for (
                            let i = 0;
                            i < newContent.length;
                            i += itemsPerChunk
                        ) {
                            const con = newContent.slice(i, i + itemsPerChunk);
                            const path = `${entryName}-${i + startIndex}.json`;
                            chunks.push({
                                path,
                                content: con,
                            });
                        }
                        // in overlap mode, ensure we mark remote files that are not in chunks as deleted (content null)
                        if (isOverlap) {
                            [
                                ...remoteStructure.chunks,
                                // ...remoteStructure.assets,// 暂时保留assets
                            ].forEach((rc) => {
                                if (
                                    chunks.findIndex(
                                        (c) => c.path === rc.path,
                                    ) === -1
                                ) {
                                    chunks.push({
                                        path: rc.path,
                                        content: null,
                                    });
                                }
                            });
                        }
                        return { chunks, assets };
                    };

                    const [itemResult, metaResult] = await Promise.all([
                        runItemStashesHandler(),
                        runMetaStashesHandler(),
                    ]);

                    // prepare files for upload: we will call syncer.uploadContent with FileWithContent[]
                    const filesToUpload = [...itemResult.chunks, ...metaResult];

                    // upload assets (actual upload of binary files) - the syncer.transformAsset above only transforms keys.
                    // For GitHub syncer we need to actually upload assets as blobs to assets/<name>
                    // We'll detect assets from itemResult.assets (transformAssets returns file list)
                    const assetFiles: { path: string; content: any }[] = [];
                    // itemResult.assets items are expected to have { file: File, formattedValue } shape (as transformAssets returns)
                    (itemResult.assets || []).forEach((a) => {
                        if (a.file) {
                            const assetPath = getSyncer().assetEntryToPath(
                                a,
                                storeFullName,
                            );
                            assetFiles.push({
                                path: assetPath,
                                content: a.file,
                            });
                        }
                    });

                    // combine assetFiles (binary) and filesToUpload (json blobs)
                    // For syncer.uploadContent we expect content either real content (for json) or File for binary - implementor should handle both.
                    const newStructure = await syncer.uploadContent(
                        storeFullName,
                        [...assetFiles, ...filesToUpload],
                    );

                    // after success, delete local stashes & update local meta
                    await Promise.all([
                        itemBucket.deleteStashes(
                            ...stashes.map((s: any) => s.id),
                        ),
                        itemBucket.configStorage.setValue({
                            structure: newStructure,
                        }),
                        (async () => {
                            if (metaResult[0]) {
                                await itemBucket.metaStorage.setValue(
                                    metaResult[0].content,
                                );
                            }
                        })(),
                    ]);
                },
            ),
        );
    };

    const hasStashes = async () => {
        const somes = await Promise.all(
            Array.from(storeMap.values()).map(async ({ itemBucket }) => {
                const items = await itemBucket.stashStorage.toArray();
                return items.length > 0;
            }),
        );
        return somes.some((v) => v);
    };

    // sync() returns [pendingPromise, cancelFn]
    const sync = () => {
        const ac = new AbortController();
        const p = syncImmediate(ac.signal);
        const cancel = () => ac.abort();
        return [p, cancel] as const;
    };

    const detach = async (stores?: string[]) => {
        const storeNames = stores ?? Array.from(storeMap.keys());
        return Promise.all(
            storeNames.map(async (name) => {
                const s = storageFactory(name);
                await s.dangerousClearAll();
                storeMap.delete(name);
            }),
        );
    };

    return {
        init,
        create,
        getAllItems,
        getMeta,
        batch,
        sync,
        detach,
        getAsset: (key: string, store: string) => {
            return getSyncer().getAsset(key, store);
        },
        getUserInfo: (id?: string) => getSyncer().getUserInfo(id),
        getCollaborators: (id: string) => getSyncer().getCollaborators(id),
        fetchAllStore: () => getSyncer().fetchAllStore(),
        onChange,
        hasStashes,
    };
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
        if (c.sha !== local.chunks[i]?.sha) {
            return true;
        }
        return false;
    });
    if (diffChunkIndex !== -1) {
        diff.chunks = remote.chunks.slice(diffChunkIndex);
    }

    return { diff, patch: diffChunkIndex !== 0 };
};
