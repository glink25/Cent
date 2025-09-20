import { v4 } from "uuid";

export type BaseItem = {
    id: string;
    [key: string]: any;
};

export type Update<T extends BaseItem> = {
    type: "update";
    timestamp: number
    id: string
    value: T;
    metaValue?: undefined
}

export type Delete<T extends BaseItem> = {
    type: "delete";
    timestamp: number
    id: string
    value: T["id"];
    metaValue?: undefined
}

export type MetaUpdate = {
    type: 'meta';
    timestamp: number
    id: string
    value?: undefined
    metaValue: any
}

export type FullAction<T extends BaseItem> = Update<T> | Delete<T> | MetaUpdate

export type Action<T extends BaseItem> = Omit<FullAction<T>, 'timestamp' | 'id'>

export type Full<T extends BaseItem> = T & { __delete_at?: number, __create_at: number, __update_at: number }

export type Arrayable<T extends BaseItem> = {
    put: (...v: T[]) => Promise<void>
    delete: (...ids: T['id'][]) => Promise<void>
    clear: () => Promise<void>
    toArray: () => Promise<T[]>
}

export type FactoryNames = typeof StashBucket.STASH_NAME | typeof StashBucket.ITEM_NAME

export type ArrayableStorageFactory = <T extends BaseItem> (name: FactoryNames) => Arrayable<T>

export type StorageFactory = (name: typeof StashBucket.META_NAME) => {
    setValue: (v: any) => Promise<void>
    getValue: () => Promise<any>
}


export interface StashStorage {
    createArrayableStorage: ArrayableStorageFactory
    createStorage: StorageFactory
    dangerousClearAll: () => Promise<void>
}

export class StashBucket<T extends BaseItem> {
    static STASH_NAME = '__stashes' as const
    static ITEM_NAME = '__items' as const
    static META_NAME = '__meta' as const
    private readonly factory: ArrayableStorageFactory
    private readonly metaFactory: StorageFactory


    constructor(factory: ArrayableStorageFactory, metaFactory: StorageFactory) {
        this.factory = factory
        this.metaFactory = metaFactory
    }

    get metaStorage() {
        return this.metaFactory(StashBucket.META_NAME)
    }

    get stashStorage() {
        return this.factory<FullAction<T>>(StashBucket.STASH_NAME)
    }

    get itemStorage() {
        return this.factory<Full<T>>(StashBucket.ITEM_NAME)
    }

    async init(items: FullAction<T>[], meta?: any) {
        if (meta !== undefined) {
            await this.metaStorage.setValue(meta)
        }
        await this.itemStorage.clear()
        await this.applyStash(items)
        const localStashes = await this.getStashes()
        await this.applyStash(localStashes)

    }


    getItems() {
        return this.itemStorage.toArray()
    }

    getStashes() {
        return this.stashStorage.toArray()
    }

    getMeta() {
        return this.metaStorage.getValue()
    }

    async batch(actions: Action<T>[]) {
        const now = Date.now()
        const fullActions = actions.map(ac => ({ ...ac, id: v4(), timestamp: now }) as FullAction<T>)
        const prevActions = await this.getStashes()
        const densed = denseStashes([...fullActions, ...prevActions])
        await this.stashStorage.clear()
        await this.stashStorage.put(...densed)
        const stashed = await this.stashStorage.toArray()
        // apply stash
        await this.applyStash(stashed)

    }

    private async applyStash(stashed: FullAction<T>[]) {
        const { updates, deletes, meta } = stashed.reduce((p, c) => {
            if (c.type === 'update') {
                p.updates.push(c)
            } else if (c.type === 'delete') {
                p.deletes.push(c)
            } else if (c.type === 'meta') {
                p.meta = c
            }
            return p
        }, { updates: [] as Update<T>[], deletes: [] as Delete<T>[], meta: undefined as MetaUpdate | undefined })
        await Promise.all([
            this.itemStorage.put(...updates.map(ac => ({ ...ac.value, __create_at: ac.timestamp, __update_at: ac.timestamp }))),
            this.itemStorage.delete(...deletes.map(ac => ac.value)),
            meta && this.metaStorage.setValue({ ...meta.metaValue, __update_at: meta.timestamp })
        ])
    }

    async deleteStashes(...ids: FullAction<T>['id'][]) {
        this.stashStorage.delete(...ids)
    }
}

// 对多个相同id的操作，只保留最新的
function denseStashes<T extends BaseItem>(stashes: FullAction<T>[]) {
    const ids = new Set<string>()
    return stashes.filter(ac => {
        const targetId = ac.type === 'meta'
            ? '_meta'
            : ac.type === 'delete'
                ? ac.value
                : ac.value.id
        if (ids.has(targetId)) {
            return false
        }
        ids.add(targetId)
        return true
    })
}