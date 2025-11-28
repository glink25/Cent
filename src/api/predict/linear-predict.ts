// 假设用户记账数据结构
// type Bill = { time: number, categoryId: string, comment: string,location:[number,number] };
// 🛠️ 预测系统设计概览模块目的依赖PredictionModel核心类，管理并持久化统计数据。LocalStorage (或 IndexedDB)分类预测预测在特定小时最常使用的分类。统计数据：hour_category_counts备注预测预测在特定分类下最常出现的备注关键词。jieba-wasm, 统计数据：category_word_counts增量学习每次用户成功记账后，更新统计数据。
import { type DBSchema, deleteDB, type IDBPDatabase, openDB } from "idb";
import type { Bill } from "@/ledger/type";
import { processText } from "@/utils/word";

type CountMap = Record<string, number>;
type HourCategoryCounts = Record<string, CountMap>;
type CategoryWordCounts = Record<string, CountMap>;

// 在原文件顶部或合适位置添加这些类型/配置
type LearnOptions = {
    /** 半衰期（天），默认 30 天：30 天前权重为 0.5 */
    halfLifeDays?: number;
    /** 清理阈值，低于该值的计数会被删除，默认 0.01 */
    minCountThreshold?: number;
};

// 辅助：对 hour_category_counts 和 category_word_counts 进行衰减
function applyDecayToHourCounts(
    hourCounts: HourCategoryCounts,
    decayFactor: number,
    minCountThreshold: number,
) {
    for (const hourKey of Object.keys(hourCounts)) {
        const catMap = hourCounts[hourKey];
        for (const cat of Object.keys(catMap)) {
            catMap[cat] = (catMap[cat] || 0) * decayFactor;
            if (catMap[cat] < minCountThreshold) {
                delete catMap[cat];
            }
        }
        // 如果 hourKey 下没有任何分类，删除该 hourKey
        if (Object.keys(catMap).length === 0) {
            delete hourCounts[hourKey];
        }
    }
}

function applyDecayToCommentCounts(
    commentCounts: CategoryWordCounts,
    decayFactor: number,
    minCountThreshold: number,
) {
    for (const category of Object.keys(commentCounts)) {
        const wordMap = commentCounts[category];
        for (const w of Object.keys(wordMap)) {
            wordMap[w] = (wordMap[w] || 0) * decayFactor;
            if (wordMap[w] < minCountThreshold) {
                delete wordMap[w];
            }
        }
        if (Object.keys(wordMap).length === 0) {
            delete commentCounts[category];
        }
    }
}

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
 * 对指定账本进行学习（带时间加权）
 * - options.halfLifeDays: 半衰期（天），默认 30
 * - options.minCountThreshold: 清理阈值，默认 0.01
 */
export const learn = async (
    book: string,
    bills: Bill[],
    meta?: { timeRange: [number, number] },
    options?: LearnOptions,
) => {
    const model = await loadModel(book);
    const hour_category_counts = model.categoryModel;
    const category_word_counts = model.commentModel;

    const now = Date.now();
    const halfLifeDays = options?.halfLifeDays ?? 30;
    const minCountThreshold = options?.minCountThreshold ?? 0.01;
    const halfLifeMs = halfLifeDays * 24 * 3600 * 1000;
    const lambda = Math.LN2 / halfLifeMs; // decay rate

    // 取上次更新时间（优先使用 meta.updatedAt，再退回到传入的 meta.timeRange 的结束时间）
    const lastUpdatedMs =
        (model.meta && (model.meta.updatedAt as number)) ??
        (meta && meta.timeRange ? meta.timeRange[1] : undefined) ??
        now;

    const deltaMs = Math.max(0, now - lastUpdatedMs);
    const decayFactor = Math.exp(-lambda * deltaMs);

    // 把已有的统计衰减到当前时刻（旧数据权重自动降低）
    if (deltaMs > 0 && decayFactor < 1) {
        applyDecayToHourCounts(
            hour_category_counts,
            decayFactor,
            minCountThreshold,
        );
        applyDecayToCommentCounts(
            category_word_counts,
            decayFactor,
            minCountThreshold,
        );
    }

    // 对每条传入账单，根据账单时间与当前时刻的差距再单独计算权重，然后累加（最近的权重大）
    for (const b of bills) {
        const { time: timestamp, categoryId: category, comment: remark } = b;
        const hourKey = getHourKey(timestamp);

        // 按账单的时间计算权重：越接近 now 权重越接近 1，越久远权重越小
        const billDeltaMs = Math.max(0, now - timestamp);
        const billWeight = Math.exp(-lambda * billDeltaMs);

        // 分类小时统计：加上权重（不是简单 +1）
        hour_category_counts[hourKey] = hour_category_counts[hourKey] || {};
        hour_category_counts[hourKey][category] =
            (hour_category_counts[hourKey][category] || 0) + billWeight;

        // 备注/关键词统计（jieba 返回词频也按权重相乘）
        if (remark) {
            category_word_counts[category] =
                category_word_counts[category] || {};
            try {
                const wordList = await processText(remark, 150);
                wordList.forEach(([word, count]) => {
                    if (!word || word.length <= 1) return;
                    // 词频 count * billWeight
                    const add = count * billWeight;
                    category_word_counts[category][word] =
                        (category_word_counts[category][word] || 0) + add;
                });
            } catch (e) {
                console.error("incrementalLearn: processText error", e);
            }
        }
    }

    // 清理极小值（再次统一清理，避免残留非常小的浮点数）
    applyDecayToHourCounts(hour_category_counts, 1, minCountThreshold);
    applyDecayToCommentCounts(category_word_counts, 1, minCountThreshold);

    const toSave: StoredModel = {
        meta: model.meta,
        categoryModel: hour_category_counts,
        commentModel: category_word_counts,
    };

    if (meta) {
        toSave.meta = { ...toSave.meta, ...meta };
    }

    // setItem 会把 meta.updatedAt 设为 Date.now()
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
