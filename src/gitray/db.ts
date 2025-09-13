import { deleteDB, openDB } from "idb";
import { ITEM_STORE_NAME, META_STORE_NAME, STASH_STORE_NAME } from "./consts";
import type {
    BaseItem,
    Full,
    GitrayDBSchema,
    IndexKeys,
    ItemAction,
} from "./type";

export type GitrayDBConfig = {
    /** 本地indexedDB实例名称
     * @default 'local-gitray'
     */
    dbName?: string;
    /**
     * (可选) 用于识别和筛选本 lib 所管理的仓库的统一前缀
     * @default 'gitray-db'
     */
    repoPrefix?: string;

    orderKeys?: string[];
};

export class GitrayDB<Item extends BaseItem, ItemIndexes extends IndexKeys> {
    protected readonly config: Required<GitrayDBConfig>;

    constructor(config: GitrayDBConfig) {
        this.config = {
            dbName: "local-gitray",
            repoPrefix: "gitray-db",
            orderKeys: [],
            ...config,
        };
        this.getDB().then((db) => db.close());
    }

    protected async getDB() {
        // const currentVersion = await getCurrentVersion(this.config.dbName);
        return openDB<GitrayDBSchema<Item, ItemIndexes>>(`${this.config.dbName}`, 1, {
            upgrade: (db) => {
                // Create stores if they don't exist
                if (!db.objectStoreNames.contains(STASH_STORE_NAME)) {
                    db.createObjectStore(STASH_STORE_NAME, {
                        autoIncrement: true,
                        keyPath: "id",
                    });
                }
                if (!db.objectStoreNames.contains(META_STORE_NAME)) {
                    const store = db.createObjectStore(META_STORE_NAME, {
                        keyPath: "path",
                    });
                    store.createIndex("path", ["path"]);
                }
                if (!db.objectStoreNames.contains(ITEM_STORE_NAME)) {
                    const store = db.createObjectStore(ITEM_STORE_NAME, {
                        keyPath: "id",
                    });
                    store.createIndex("__store", "__store");
                    store.createIndex("__store___created_at", [
                        "__store",
                        "__created_at",
                    ]);
                    this.config.orderKeys.forEach((k) => {
                        const pair = ["__store", k];
                        store.createIndex(pair.join("_"), pair, { unique: false });
                    });
                }
            },
        });
    }

    protected async getStash() {
        const db = await this.getDB();
        const stashStore = db
            .transaction(STASH_STORE_NAME)
            .objectStore(STASH_STORE_NAME);
        const stashed = await stashStore.getAll();
        return stashed;
    }

    async getIsNeedSync() {
        return (await this.getStash()).length > 0
    }
    /**
     * 获取指定collection的所有item
     * @param storeFullName store的全名，包含login/前缀
     * @param collection collection名称
     * @param withStash 是否要与本地的stash合并
     */
    async getAllItems(
        storeFullName: string,
        withStash: boolean = false,
        orderBy?: [string, "asc" | "desc"],
    ): Promise<Full<Item>[]> {
        const db = await this.getDB();

        const itemStore = db
            .transaction(ITEM_STORE_NAME)
            .objectStore(ITEM_STORE_NAME);
        const index = orderBy
            ? itemStore.index(["__store", orderBy[0]].join("_"))
            : itemStore.index("__store");
        const direction = orderBy?.[1] === "asc" ? "next" : "prev"; // 或 'prev'，根据需要选择升序或降序

        const localItems: Full<Item>[] = [];
        const range = orderBy
            ? IDBKeyRange.bound([storeFullName, 0], [storeFullName, Infinity])
            : IDBKeyRange.only(storeFullName);
        let cursor = await index.openCursor(range, direction);
        while (cursor) {
            localItems.push(cursor.value);
            cursor = await cursor.continue();
        }
        if (withStash) {
            const stashed = await this.getStash();
            applyStash(
                localItems,
                stashed
                    .filter((ac) => ac.type !== "meta")
                    .filter((ac) => storeFullName === ac.store),
                orderBy,
            );
            return localItems;
        }

        return localItems;
    }

    async getMeta(
        storeFullName: string,
        collectionName?: string | number,
        withStash: boolean = true,
    ) {
        const db = await this.getDB();
        const metaId = `${storeFullName}${collectionName ? `/${collectionName}` : ""}`;
        const localMeta = (await db.get(META_STORE_NAME, metaId))?.value || {};
        db.close();
        if (withStash) {
            const stashed = await this.getStash();
            const metaStashes = stashed
                .filter((ac) => ac.type === "meta")
                .filter((ac) => {
                    if (storeFullName !== ac.store) return false;
                    return collectionName === ac.collection;
                });
            return metaStashes[metaStashes.length - 1]?.params || localMeta;
        }
        return localMeta;
    }

    dangerousClearAll() {
        return deleteDB(this.config.dbName);
    }
}


export const applyStash = <Item extends BaseItem>(
    target: Full<Item>[],
    stashed: ItemAction<Full<Item>>[],
    orderBy?: [string, "asc" | "desc"],
): Full<Item>[] => {
    // 如果没有提供 orderBy 参数，使用原始的简单逻辑以提高效率
    if (!orderBy) {
        stashed.forEach((ac) => {
            if (ac.type === "add") {
                target.push({ ...ac.params });
            } else if (ac.type === "remove") {
                const index = target.findIndex((b) => b.id === ac.params);
                if (index !== -1) {
                    target.splice(index, 1);
                }
            } else if (ac.type === "update") {
                const index = target.findIndex((b) => b.id === ac.params.id);
                if (index !== -1) {
                    target[index] = { ...target[index], ...ac.params.changes };
                }
            }
        });
        return target;
    }

    // --- 带排序逻辑的核心实现 ---
    const [key, dir] = orderBy;

    // 定义一个辅助函数，用于将项插入到已排序数组的正确位置
    const sortedInsert = (arr: Full<Item>[], item: Full<Item>) => {
        // 寻找插入点：找到第一个比当前项“大”的元素
        const insertionIndex = arr.findIndex((existingItem) =>
            dir === "asc"
                ? existingItem[key] > item[key]
                : existingItem[key] < item[key],
        );

        if (insertionIndex === -1) {
            // 如果没找到，说明当前项是最大（或最小）的，直接推入数组末尾
            arr.push(item);
        } else {
            // 否则，插入到找到的那个元素之前
            arr.splice(insertionIndex, 0, item);
        }
    };

    // 遍历所有操作
    stashed.forEach((ac) => {
        if (ac.type === "add") {
            const newItem = { ...ac.params } as Full<Item>;
            sortedInsert(target, newItem);
        } else if (ac.type === "remove") {
            const index = target.findIndex((b) => b.id === ac.params);
            if (index !== -1) {
                target.splice(index, 1);
            }
        } else if (ac.type === "update") {
            const index = target.findIndex((b) => b.id === ac.params.id);
            if (index === -1) {
                return; // 如果未找到要更新的项，则跳过
            }

            // 检查被更新的属性中是否包含排序键
            const sortKeyChanged = Object.hasOwn(ac.params.changes, key);

            if (!sortKeyChanged) {
                // 如果排序键未改变，直接在原位置更新，不影响排序
                target[index] = {
                    ...target[index],
                    ...ac.params.changes,
                };
            } else {
                // 如果排序键已改变，项的位置可能需要移动
                // 1. 先从原位置移除
                const [itemToMove] = target.splice(index, 1);
                // 2. 应用更改
                const updatedItem = { ...itemToMove, ...ac.params.changes };
                // 3. 将更新后的项插入到新的正确位置
                sortedInsert(target, updatedItem);
            }
        }
    });

    return target;
};