import { type DBSchema, deleteDB, openDB } from "idb";

/**
 * 1. 类型定义
 */
interface CacheEntry {
    key: string; // 参数指纹
    value: any; // 缓存数据
    timestamp: number; // LRU 排序时间戳
    size: number; // 数据大小
}

// 定义 DB Schema，获得更好的 TS 类型提示
interface CacheDB extends DBSchema {
    store: {
        key: string;
        value: CacheEntry;
        indexes: { timestamp: number };
    };
}

/**
 * 2. 辅助函数：计算数据大小
 */
function calculateSize(value: any): number {
    if (value instanceof Blob) return value.size;
    if (value instanceof ArrayBuffer) return value.byteLength;
    if (typeof value === "string") return value.length * 2;
    try {
        return new Blob([JSON.stringify(value)]).size;
    } catch {
        return 0;
    }
}

function getDBKey(key: string) {
    return `cache_in_db_${key}`;
}

/**
 * 3. 核心 Cache 函数
 */
export function cacheInDB<T extends (...args: any[]) => Promise<any>>(
    fn: T,
    key: string, // 这里的 key 作为数据库名称的一部分，相当于命名空间
    max = 100,
): T {
    const dbName = getDBKey(key);

    // 数据库初始化逻辑
    const initDB = () =>
        openDB<CacheDB>(dbName, 1, {
            upgrade(db) {
                if (!db.objectStoreNames.contains("store")) {
                    const store = db.createObjectStore("store", {
                        keyPath: "key",
                    });
                    store.createIndex("timestamp", "timestamp");
                }
            },
        });

    const cachedFn = async (...args: Parameters<T>): Promise<ReturnType<T>> => {
        const argsKey = JSON.stringify(args);

        // 打开数据库
        const db = await initDB();

        // 尝试获取缓存 (Transaction 1: 只读)
        const cachedRecord = await db.get("store", argsKey);

        if (cachedRecord) {
            // HIT: 异步更新时间戳 (开启一个新事务，不阻塞当前返回)
            // 注意：不要 await 这个操作，让它在后台执行即可加快响应速度
            (async () => {
                const updateTx = db.transaction("store", "readwrite");
                const record = { ...cachedRecord, timestamp: Date.now() };
                await updateTx.store.put(record);
            })();

            return cachedRecord.value;
        }

        // MISS: 执行原函数
        const result = await fn(...args);

        // 存入缓存 (Transaction 2: 读写)
        // 注意：IndexedDB 事务不能跨越 await (event loop ticks)，所以必须在网络请求回来后开新事务
        const tx = db.transaction("store", "readwrite");
        const store = tx.objectStore("store");

        const size = calculateSize(result);

        await store.put({
            key: argsKey,
            value: result,
            timestamp: Date.now(),
            size,
        });

        // LRU 检查与清理
        const count = await store.count();
        if (count > max) {
            // 获取最旧的一条记录 (timestamp 最小)
            const index = store.index("timestamp");
            const cursor = await index.openCursor(null, "next");
            if (cursor) {
                await cursor.delete();
            }
        }

        await tx.done; // 等待事务完成
        return result;
    };

    return cachedFn as T;
}

/**
 * 4. 获取缓存统计信息
 */
export const getCachedInfo = async (key: string) => {
    const dbName = getDBKey(key);

    // 检查数据库是否存在，避免不必要的 open 操作
    const dbs = await window.indexedDB.databases();
    if (!dbs.find((d) => d.name === dbName)) {
        return { count: 0, total: 0 };
    }

    const db = await openDB<CacheDB>(dbName, 1);

    let count = 0;
    let total = 0;

    // 使用 Cursor 遍历只读取 meta 信息，不加载整个对象到内存，性能最高
    let cursor = await db.transaction("store").store.openCursor();

    while (cursor) {
        count++;
        total += cursor.value.size;
        cursor = await cursor.continue();
    }

    db.close(); // 查完记得关闭连接
    return { count, total };
};

/**
 * 5. 新增：手动清除指定缓存
 * @param key 初始化 cache 时传入的 key
 */
export const clearCached = async (key: string) => {
    const dbName = getDBKey(key);
    // deleteDB 是 idb 提供的工具，直接删除整个数据库，彻底释放空间
    await deleteDB(dbName);
    console.log(`Cache [${key}] has been cleared.`);
};
