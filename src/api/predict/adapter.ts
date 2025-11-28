import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from "idb";

// 保持原有结构，扩展字段以存储 TFJS 模型数据
export const DB_NAME = "cent_predict";
export const STORE_NAME = "models";
const DB_VERSION = 2; // 升级版本号

// TFJS 需要保存的模型工件结构
export interface TFModelArtifacts {
    modelTopology: any; // JSON object
    weightSpecs: any[];
    weightData: ArrayBuffer; // 二进制权重数据
}

export type StoredModel = {
    meta?: {
        updatedAt?: number;
        version?: number;
        timeRange?: [number, number];
        [k: string]: unknown;
    };
    // --- 混合模型数据 ---
    // 1. 神经网络部分 (用于分类预测)
    tfArtifacts?: TFModelArtifacts;
    categoryMap?: string[]; // Index -> CategoryID 映射
    locationBounds?: {
        // 用于归一化经纬度
        minLat: number;
        maxLat: number;
        minLng: number;
        maxLng: number;
    };

    // 2. 统计学部分 (用于备注预测 - 依然保留词频统计，因其对文本推荐性价比最高)
    commentModel?: Record<string, Record<string, number>>; // CategoryId -> Word -> Count
};

interface PredictDB extends DBSchema {
    models: {
        key: string; // bookId
        value: StoredModel;
    };
}

// 单例模式避免频繁打开
let _dbPromise: Promise<IDBPDatabase<PredictDB>> | null = null;

function getDB(): Promise<IDBPDatabase<PredictDB>> {
    if (!_dbPromise) {
        _dbPromise = openDB<PredictDB>(DB_NAME, DB_VERSION, {
            upgrade(db, oldVersion, newVersion, transaction) {
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            },
        });
    }
    return _dbPromise;
}

export async function getItem(book: string): Promise<StoredModel | null> {
    const db = await getDB();
    const rec = await db.get(STORE_NAME, book);
    return rec ?? null;
}

export async function setItem(book: string, value: StoredModel): Promise<void> {
    const db = await getDB();
    const stored: StoredModel = {
        ...value,
        meta: { updatedAt: Date.now(), ...(value.meta ?? {}) },
    };
    await db.put(STORE_NAME, stored, book);
}

export const clearDB = async (): Promise<void> => {
    _dbPromise = null; // 重置连接
    await deleteDB(DB_NAME);
};
