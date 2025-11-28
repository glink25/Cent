// 假设用户记账数据结构
// type Bill = { time: number, categoryId: string, comment: string,location:[number,number] };
// 🛠️ 预测系统设计概览模块目的依赖PredictionModel核心类，管理并持久化统计数据。LocalStorage (或 IndexedDB)分类预测预测在特定小时最常使用的分类。统计数据：hour_category_counts备注预测预测在特定分类下最常出现的备注关键词。jieba-wasm, 统计数据：category_word_counts增量学习每次用户成功记账后，更新统计数据。
// 请帮我将其改为使用tensorflow js进行预测，使其能够更精确地扑捉到账单分类、备注和日期直接对联系，能够给出指定时间的合理分类+备注共同结果，对特定时间，例如周末、上午、下午的记账有更高的敏感度，以及可能情况下还能基于地点提升预测准确性等
// 可以将核心预测算法函数抽象成新的ts文件以供调用
import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from "idb";
import type { Bill } from "@/ledger/type";
import { processText } from "@/utils/word";

type CountMap = Record<string, number>;
type HourCategoryCounts = Record<string, CountMap>;
type CategoryWordCounts = Record<string, CountMap>;

// IndexedDB config
const DB_NAME = "cent_predict";
const STORE_NAME = "models";
const DB_VERSION = 1;

// Stored model shape: each record in `models` is keyed by `book` and
// stores meta + the two models we need.
type StoredModel = {
    meta?: {
        updatedAt?: number;
        version?: number;
        timeRange?: [number, number];
        [k: string]: unknown;
    };
    categoryModel?: HourCategoryCounts;
    commentModel?: CategoryWordCounts;
};

interface PredictDB extends DBSchema {
    models: {
        key: string; // book
        value: StoredModel;
    };
}
function openIDB(): Promise<IDBPDatabase<PredictDB>> {
    return openDB<PredictDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        },
    });
}

// Pure getItem/setItem working with the book as key
async function getItem(book: string): Promise<StoredModel | null> {
    const db = await openIDB();

    const rec = await db.get(STORE_NAME, book);
    db.close();
    return rec ?? null;
}

async function setItem(book: string, value: StoredModel): Promise<void> {
    const db = await openIDB();

    const stored: StoredModel = {
        ...value,
        meta: { updatedAt: Date.now(), ...(value.meta ?? {}) },
    };
    await db.put(STORE_NAME, stored, book);
    db.close();
}

function getHourKey(timestamp: number) {
    const date = new Date(timestamp);
    return `hour_${date.getHours()}`;
}

async function loadModel(book: string): Promise<Required<StoredModel>> {
    const rec = await getItem(book);
    return {
        meta: rec?.meta ?? {},
        categoryModel: rec?.categoryModel ?? {},
        commentModel: rec?.commentModel ?? {},
    };
}

/**
 * 对指定账本进行学习：对传入的账单数组执行增量学习并持久化。
 * `meta.timeRange` 可用于区分哪些账单是新增（调用方负责传入新增账单或过滤）。
 */
export const learn = async (
    book: string,
    bills: Bill[],
    meta?: { timeRange: [number, number] },
) => {
    const model = await loadModel(book);
    const hour_category_counts = model.categoryModel;
    const category_word_counts = model.commentModel;

    for (const b of bills) {
        const { time: timestamp, categoryId: category, comment: remark } = b;
        const hourKey = getHourKey(timestamp);

        hour_category_counts[hourKey] = hour_category_counts[hourKey] || {};
        hour_category_counts[hourKey][category] =
            (hour_category_counts[hourKey][category] || 0) + 1;

        if (remark) {
            category_word_counts[category] =
                category_word_counts[category] || {};
            try {
                const wordList = await processText(remark, 150);
                wordList.forEach(([word, count]) => {
                    if (!word || word.length <= 1) return;
                    category_word_counts[category][word] =
                        (category_word_counts[category][word] || 0) + count;
                });
            } catch (e) {
                console.error("incrementalLearn: processText error", e);
            }
        }
    }

    const toSave: StoredModel = {
        meta: model.meta,
        categoryModel: hour_category_counts,
        commentModel: category_word_counts,
    };

    if (meta) {
        toSave.meta = { ...toSave.meta, ...meta };
    }

    await setItem(book, toSave);
};

/**
 * 获取指定账本的持久化 meta 信息（如果存在）。
 */
export const getPredictModelMeta = async (
    book: string,
): Promise<{ timeRange: [number, number] } | undefined> => {
    const rec = await getItem(book);
    if (!rec?.meta?.timeRange) return undefined;
    return { timeRange: rec.meta.timeRange as [number, number] };
};

/**
 * 预测指定账本在给定时间点下最可能出现的分类或备注关键词。
 */
export const predict = async (
    book: string,
    target: "category" | "comment",
    time: number,
    topN = 3,
): Promise<string[]> => {
    const model = await loadModel(book);
    if (target === "category") {
        const hourKey = getHourKey(time);
        const counts = model.categoryModel[hourKey];
        if (!counts) return [];
        const sortedCategories = Object.entries(counts)
            .sort(([, countA], [, countB]) => countB - countA)
            .map(([category]) => category);
        return sortedCategories.slice(0, topN);
    }

    // target === 'comment'
    const hourKey = getHourKey(time);
    const counts = model.categoryModel[hourKey];
    if (!counts) return [];
    const topCategory = Object.entries(counts)
        .sort(([, a], [, b]) => b - a)
        .map(([c]) => c)[0];
    if (!topCategory) return [];
    const words = model.commentModel[topCategory];
    if (!words) return [];
    const sortedWords = Object.entries(words)
        .sort(([, a], [, b]) => b - a)
        .map(([word]) => word);
    return sortedWords.slice(0, topN);
};

/**
 * 清除预测模块使用的 IndexedDB 数据库及其所有内容。
 */
export const clear = async (): Promise<void> => {
    await deleteDB(DB_NAME);
};
