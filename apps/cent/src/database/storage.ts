import { type DBSchema, deleteDB, openDB } from "idb";
import type { Bill } from "@/ledger/type";
import {
    type Action,
    type ArrayableStorageFactory,
    type Full,
    StashBucket,
    type StashStorage,
    type StorageFactory,
} from "./stash";

const DB_VERSION = 2;

export interface GitrayDBSchema extends DBSchema {
    [StashBucket.STASH_NAME]: {
        key: string;
        value: Action<Full<Bill>>;
        indexes: {
            timestamp: string;
        };
    };
    [StashBucket.ITEM_NAME]: {
        key: string;
        value: Full<Bill>;
        indexes: {
            time: string;
            creatorId: string;
        };
    };
    [StashBucket.META_NAME]: {
        key: string;
        value: { id: "metaKey"; value: any };
    };
    [StashBucket.CONFIG_NAME]: {
        key: string;
        value: { id: "metaKey"; value: any };
    };
}

export class BillIndexedDBStorage implements StashStorage {
    public readonly dbName: string;

    constructor(dbName: string) {
        this.dbName = dbName;
    }
    getDB() {
        return openDB<GitrayDBSchema>(this.dbName, DB_VERSION, {
            upgrade: (db, oldVersion, newVersion, transaction) => {
                if (!db.objectStoreNames.contains(StashBucket.STASH_NAME)) {
                    const store = db.createObjectStore(StashBucket.STASH_NAME, {
                        autoIncrement: true,
                        keyPath: "id",
                    });
                    store.createIndex("timestamp", "timestamp");
                }
                if (!db.objectStoreNames.contains(StashBucket.ITEM_NAME)) {
                    const store = db.createObjectStore(StashBucket.ITEM_NAME, {
                        keyPath: "id",
                    });
                    store.createIndex("time", "time");
                    store.createIndex("creatorId", "creatorId");
                }
                if (!db.objectStoreNames.contains(StashBucket.META_NAME)) {
                    db.createObjectStore(StashBucket.META_NAME, {
                        autoIncrement: true,
                        keyPath: "id",
                    });
                }
                if (!db.objectStoreNames.contains(StashBucket.CONFIG_NAME)) {
                    db.createObjectStore(StashBucket.CONFIG_NAME, {
                        autoIncrement: true,
                        keyPath: "id",
                    });
                }
            },
        });
    }

    async getItem<T>(id: string): Promise<T | undefined> {
        const db = await this.getDB();
        try {
            return (await db.get(StashBucket.ITEM_NAME, id)) as T | undefined;
        } finally {
            db.close();
        }
    }

    async readRecentItems<T>(
        limit: number,
        matchesId: (id: string) => boolean,
        matches: (item: T) => boolean,
        idPrefix?: string,
    ): Promise<T[]> {
        if (limit <= 0) return [];
        const db = await this.getDB();
        try {
            const store = db.transaction(StashBucket.ITEM_NAME).store;
            const items: T[] = [];
            let cursor =
                idPrefix === undefined
                    ? await store.index("time").openCursor(null, "prev")
                    : await store.openCursor(
                          IDBKeyRange.bound(idPrefix, `${idPrefix}\uffff`),
                          "prev",
                      );
            while (cursor) {
                if (matchesId(cursor.primaryKey)) {
                    const item = cursor.value as T;
                    if (matches(item)) items.push(item);
                }
                if (items.length === limit) break;
                cursor = await cursor.continue();
            }
            return items;
        } finally {
            db.close();
        }
    }

    createArrayableStorage: ArrayableStorageFactory = (name) => {
        return {
            put: async (...v) => {
                const db = await this.getDB();
                const tx = db.transaction(name, "readwrite");
                const store = tx.objectStore(name);
                await Promise.all(v.map((item) => store.put(item as any)));
                await tx.done;
                db.close();
            },
            delete: async (...ids) => {
                const db = await this.getDB();
                const tx = db.transaction(name, "readwrite");
                const store = tx.objectStore(name);
                await Promise.all(ids.map((id) => store.delete(id)));
                await tx.done;
                db.close();
            },
            clear: async () => {
                const db = await this.getDB();
                await db.clear(name);
                db.close();
            },
            toArray: async (limit?: number) => {
                const db = await this.getDB();
                const { store, index } = (() => {
                    if (name === StashBucket.STASH_NAME) {
                        const store = db
                            .transaction(StashBucket.STASH_NAME)
                            .objectStore(StashBucket.STASH_NAME);
                        const index = store.index("timestamp");
                        return {
                            store,
                            index,
                        };
                    }
                    const store = db
                        .transaction(StashBucket.ITEM_NAME)
                        .objectStore(StashBucket.ITEM_NAME);
                    const index = store.index("time");
                    return {
                        store,
                        index,
                    };
                })();
                const direction = "prev";

                const localItems: any[] = [];
                const range = IDBKeyRange.bound(-Infinity, Infinity);
                if (limit === undefined && name === StashBucket.ITEM_NAME) {
                    try {
                        return (await index.getAll(range)).reverse();
                    } finally {
                        db.close();
                    }
                }
                let cursor = await index.openCursor(range, direction);
                while (cursor) {
                    localItems.push(cursor.value);
                    if (limit !== undefined && localItems.length >= limit) {
                        break;
                    }
                    cursor = await cursor.continue();
                }
                db.close();
                return localItems;
            },
        };
    };

    createStorage: StorageFactory = (name) => {
        return {
            setValue: async (v) => {
                const db = await this.getDB();
                const tx = db.transaction(name, "readwrite");
                const store = tx.objectStore(name);
                await store.put({ id: "metaKey", value: v });
                await tx.done;
                db.close();
            },
            getValue: async () => {
                const db = await this.getDB();
                const tx = db.transaction(name, "readonly");
                const store = tx.objectStore(name);
                const value = await store.get("metaKey");
                await tx.done;
                db.close();
                return value?.value;
            },
        };
    };
    clearStorages = () => {
        return deleteDB(this.dbName);
    };

    dangerousClearAll = async () => {
        // return deleteDB(this.dbName);
        const databases = await indexedDB.databases();
        await Promise.all(
            databases.map((db) => {
                const dbName = db.name;
                if (dbName === undefined) {
                    return;
                }
                return deleteDB(dbName);
            }),
        );
    };

    static getArrableStorageNames() {
        return indexedDB.databases();
    }
}
