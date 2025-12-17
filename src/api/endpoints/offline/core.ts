import type { ChangeListener } from "@/api/endpoints/type";
import {
    type Action,
    type BaseItem,
    StashBucket,
    type StashStorage,
} from "@/database/stash";
import type { Bill } from "@/ledger/type";

export type Processor = (finished: Promise<void>) => void;

export type OfflineStorageConfig = {
    storage: (storeFullBame: string) => StashStorage;
};

type Item = Bill;

const PREFIX = "offline/";

const toBookName = (bookId: string) => {
    return bookId.replace(`book-${PREFIX}`, "");
};

export class OfflineStorage {
    protected readonly config: Required<OfflineStorageConfig>;

    constructor(config: OfflineStorageConfig) {
        this.config = {
            ...config,
        };
    }
    async fetchAllStore() {
        try {
            const databases = await indexedDB.databases();
            return databases
                .map((db) => db.name)
                .filter((name) => name !== undefined)
                .filter((name) => name.startsWith(`book-${PREFIX}`))
                .map((name) => ({
                    id: name.replace("book-", ""),
                    name: toBookName(name),
                }));
        } catch (error) {
            console.error("获取数据库列表时出错:", error);
            return [];
        }
    }

    /** 根据名字创建一个store
     * 在本地indexedDB 中创建一个对应名称的
     */
    async createStore(name: string): Promise<{ id: string; name: string }> {
        const book = { id: `${PREFIX}${name}`, name: name };
        await this.initStore(book.id);
        return book;
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
        await this.getStore(storeFullName).itemBucket.patch([]);
        this.notifyChange(storeFullName);
        return;
    }
    async deleteStore(storeFullName: string) {
        this.getStore(storeFullName);
        await this.storeMap.get(storeFullName)?.storage.dangerousClearAll();
        this.notifyChange(storeFullName);
        return;
    }

    async batch(
        storeFullName: string,
        actions: Action<Item>[],
        overlap = false,
    ) {
        const { itemBucket } = this.getStore(storeFullName);
        await itemBucket.batch(actions, overlap);
        this.notifyChange(storeFullName);
        const newMeta = actions.find((v) => v.type === "meta");
        if (newMeta) {
            await itemBucket.metaStorage.setValue(newMeta?.metaValue);
        }
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
        return false;
    }

    dangerousClearAll() {
        return Promise.all(
            Array.from(this.storeMap.values()).map((c) => {
                return c.storage.dangerousClearAll();
            }),
        );
    }

    private listeners: ((finished: Promise<void>) => void)[] = [];
    onSync(processor: (finished: Promise<void>) => void) {
        this.listeners.push(processor);
        return () => {
            this.listeners = this.listeners.filter((v) => v !== processor);
        };
    }

    async toSync() {
        const finished = Promise.all(
            Array.from(this.storeMap.entries()).map(([k, value]) => {
                const { itemBucket } = value;
                return itemBucket.stashStorage.clear();
            }),
        );
        this.listeners.map((v) => v(finished.then()));
        return finished;
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
