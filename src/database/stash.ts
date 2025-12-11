import { v4 } from "uuid";
import { diff, merge } from "./merge";

export type BaseItem = {
    id: string;
    [key: string]: any;
};

export type Update<T extends BaseItem> = {
    type: "update";
    timestamp: number;
    id: string;
    value: T;
    metaValue?: undefined;
    overlap?: number;
};

export type Delete<T extends BaseItem> = {
    type: "delete";
    timestamp: number;
    id: string;
    value: T["id"];
    metaValue?: undefined;
    overlap?: number;
};

export type MetaUpdate = {
    type: "meta";
    timestamp: number;
    id: string;
    value?: undefined;
    metaValue: any;
    overlap?: number;
};

export type FullAction<T extends BaseItem> = Update<T> | Delete<T> | MetaUpdate;

export type Action<T extends BaseItem> = Omit<
    FullAction<T>,
    "timestamp" | "id"
> & {
    timestamp?: number;
};

export type Full<T extends BaseItem> = T & {
    __delete_at?: number;
    __create_at: number;
    __update_at: number;
};

export type OutputType<T> = T;

export type Arrayable<T extends BaseItem> = {
    put: (...v: T[]) => Promise<void>;
    delete: (...ids: T["id"][]) => Promise<void>;
    clear: () => Promise<void>;
    toArray: (limit?: number) => Promise<T[]>;
};

export type FactoryNames =
    | typeof StashBucket.STASH_NAME
    | typeof StashBucket.ITEM_NAME;

export type ArrayableStorageFactory = <T extends BaseItem>(
    name: FactoryNames,
) => Arrayable<T>;

export type StorageFactory<V = any> = (
    name: typeof StashBucket.META_NAME | typeof StashBucket.CONFIG_NAME,
) => {
    setValue: (v: V) => Promise<void>;
    getValue: () => Promise<V | undefined>;
};

export interface StashStorage {
    createArrayableStorage: ArrayableStorageFactory;
    createStorage: StorageFactory;
    dangerousClearAll: () => Promise<void>;
}

export class StashBucket<T extends BaseItem, Meta = any, Config = any> {
    static STASH_NAME = "__stashes" as const;
    static ITEM_NAME = "__items" as const;
    static META_NAME = "__meta" as const;
    static CONFIG_NAME = "__config" as const;
    private readonly factory: ArrayableStorageFactory;
    private readonly metaFactory: StorageFactory;

    constructor(factory: ArrayableStorageFactory, metaFactory: StorageFactory) {
        this.factory = factory;
        this.metaFactory = metaFactory;
    }

    // 用于存储全局信息
    get metaStorage() {
        return this.metaFactory(StashBucket.META_NAME) as ReturnType<
            StorageFactory<Meta>
        >;
    }
    // 用于存储数组增量信息
    get stashStorage() {
        return this.factory<FullAction<T>>(StashBucket.STASH_NAME);
    }
    // 用于存储完整数组
    get itemStorage() {
        return this.factory<Full<T>>(StashBucket.ITEM_NAME);
    }
    // 用于保存本地额外信息
    get configStorage() {
        return this.metaFactory(StashBucket.CONFIG_NAME) as ReturnType<
            StorageFactory<Config>
        >;
    }

    async init(items: FullAction<T>[], meta?: any) {
        if (meta !== undefined) {
            await this.metaStorage.setValue(meta);
        }
        await this.itemStorage.clear();
        await this.applyStash(items);
        const localStashes = await this.getStashes();
        await this.applyStash(localStashes);
    }

    async patch(items: FullAction<T>[], meta?: any) {
        if (meta !== undefined) {
            await this.metaStorage.setValue(meta);
        }
        // await this.itemStorage.clear()
        await this.applyStash(items);
        const localStashes = await this.getStashes();
        await this.applyStash(localStashes);
    }

    getItems(limit?: number) {
        return this.itemStorage.toArray(limit);
    }

    getStashes() {
        return this.stashStorage.toArray();
    }

    async getMeta() {
        const remoteMeta = await this.metaStorage.getValue();
        const stashes = await this.getStashes();
        const metaChange = stashes.find((v) => v.type === "meta");
        if (!metaChange) {
            return remoteMeta;
        }
        const fullMeta = mergeMeta(remoteMeta, metaChange.metaValue);
        return fullMeta;
    }

    async batch(actions: Action<T>[], overlap = false) {
        const now = Date.now();
        const fullActions = actions.map(
            (ac) =>
                ({
                    ...ac,
                    id: v4(),
                    timestamp: ac.timestamp ?? now,
                }) as FullAction<T>,
        );
        const prevActions = await this.getStashes();
        const densed = denseStashes([
            ...fullActions,
            ...(overlap ? [] : prevActions),
        ]);
        const metaOption = densed.find((action) => action.type === "meta");
        if (metaOption) {
            const remoteMeta = await this.metaStorage.getValue();
            metaOption.metaValue = diffMeta(
                remoteMeta ?? {},
                metaOption.metaValue,
            );
        }
        if (overlap) {
            const now = Date.now();
            densed[0].overlap = now;
            if (densed[densed.length - 1]) {
                densed[densed.length - 1].overlap = now;
            }
            if (densed[densed.length - 2]) {
                densed[densed.length - 2].overlap = now;
            }
            await this.itemStorage.clear();
        }
        await this.stashStorage.clear();
        await this.stashStorage.put(...densed);
        const stashed = await this.stashStorage.toArray();
        // apply stash
        await this.applyStash(stashed);
    }

    private async applyStash(stashed: FullAction<T>[]) {
        const { updates, deletes } = stashed.reduce(
            (p, c) => {
                if (c.type === "update") {
                    p.updates.push(c);
                } else if (c.type === "delete") {
                    p.deletes.push(c);
                }
                return p;
            },
            {
                updates: [] as Update<T>[],
                deletes: [] as Delete<T>[],
            },
        );
        await Promise.all([
            this.itemStorage.put(
                ...updates.map((ac) => ({
                    __create_at: ac.timestamp,
                    __update_at: ac.timestamp,
                    ...ac.value,
                })),
            ),
            this.itemStorage.delete(...deletes.map((ac) => ac.value)),
        ]);
    }

    async deleteStashes(...ids: FullAction<T>["id"][]) {
        this.stashStorage.delete(...ids);
    }
}

// 对多个相同id的操作，只保留最新的
function denseStashes<T extends BaseItem>(stashes: FullAction<T>[]) {
    const ids = new Set<string>();
    return stashes.filter((ac) => {
        const targetId =
            ac.type === "meta"
                ? "_meta"
                : ac.type === "delete"
                  ? ac.value
                  : ac.value.id;
        if (ids.has(targetId)) {
            return false;
        }
        ids.add(targetId);
        return true;
    });
}

const diffMeta = (prev: any, current: any) => {
    return diff(prev, current, { isDiff: true, timestamp: Date.now() });
};

export const mergeMeta = (prev: any, diff: any) => {
    if (diff.$$meta) {
        const result = merge(prev, diff);
        result.__updated_at = diff.$$meta.timestamp;
        delete result.$$meta;
        return result;
    }
    return diff;
};
