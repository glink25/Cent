/**
 * 核心逻辑层
 * 包含了 TFJS 的模型管理、训练、预测，以及对外暴露的 API
 */
import type * as TFLib from "@tensorflow/tfjs";
import type { Bill, GeoLocation } from "@/ledger/type";
import { clearDB, getItem, setItem, type TFModelArtifacts } from "./adapter";
import { extractFeatures, type LocationBounds, updateBounds } from "./features";

const loadTF = (() => {
    const loaded = import("@tensorflow/tfjs");
    return () => loaded.then((v) => v);
})();

// --- 自定义 IOHandler (桥接 TFJS 和 您的 IndexedDB) ---
class IDBHandler implements TFLib.io.IOHandler {
    private bookId: string;
    constructor(bookId: string) {
        this.bookId = bookId;
    }

    async save(
        modelArtifacts: TFLib.io.ModelArtifacts,
    ): Promise<TFLib.io.SaveResult> {
        // 1. 获取现有数据
        const current = (await getItem(this.bookId)) || {};

        // 2. 转换权重为 ArrayBuffer
        // 注意：TFJS 的 weightData 可能是 composite，这里简化处理
        const weightData = modelArtifacts.weightData as ArrayBuffer;

        const newArtifacts: TFModelArtifacts = {
            modelTopology: modelArtifacts.modelTopology,
            weightSpecs: modelArtifacts.weightSpecs!,
            weightData: weightData,
        };

        // 3. 保存回 IDB
        await setItem(this.bookId, {
            ...current,
            tfArtifacts: newArtifacts,
        });

        return {
            modelArtifactsInfo: {
                dateSaved: new Date(),
                modelTopologyType: "JSON",
            },
        };
    }

    async load(): Promise<TFLib.io.ModelArtifacts> {
        const current = await getItem(this.bookId);
        if (!current || !current.tfArtifacts) {
            throw new Error(`No model found for book ${this.bookId}`);
        }
        const { modelTopology, weightSpecs, weightData } = current.tfArtifacts;
        return { modelTopology, weightSpecs, weightData };
    }
}

// --- 预测器类 ---
class Predictor {
    private model: TFLib.LayersModel | null = null;
    private categoryMap: string[] = []; // index -> id
    private bounds: LocationBounds | undefined;
    private commentStats: Record<string, Record<string, number>> = {};
    private isReady = false;
    private book: string;

    constructor(book: string) {
        this.book = book;
    }

    // 初始化：从 IDB 加载
    async init() {
        if (this.isReady) return;
        const tf = await loadTF();
        const data = await getItem(this.book);
        if (data) {
            this.categoryMap = data.categoryMap || [];
            this.bounds = data.locationBounds;
            this.commentStats = data.commentModel || {};
            if (data.tfArtifacts) {
                try {
                    this.model = await tf.loadLayersModel(
                        new IDBHandler(this.book),
                    );
                } catch (e) {
                    console.warn("Failed to load TF model, will retrain", e);
                }
            }
        }
        this.isReady = true;
    }

    // 训练逻辑
    async train(bills: Bill[]) {
        if (bills.length < 5) return; // 数据太少不训练
        const tf = await loadTF();
        console.log(tf, "tttfff");
        // 1. 数据准备
        const inputs: number[][] = [];
        const labels: number[] = [];
        const newCategoryMap: string[] = [];
        const catToIndex: Record<string, number> = {};

        // 临时统计对象
        let newBounds = this.bounds;
        const newCommentStats = this.commentStats;

        // 第一次遍历：建立映射和边界
        bills.forEach((b) => {
            if (b.location) newBounds = updateBounds(newBounds, b.location);
            if (catToIndex[b.categoryId] === undefined) {
                catToIndex[b.categoryId] = newCategoryMap.length;
                newCategoryMap.push(b.categoryId);
            }
            // 更新备注统计 (保持原有逻辑)
            if (b.comment) {
                if (!newCommentStats[b.categoryId])
                    newCommentStats[b.categoryId] = {};
                // 注意：这里假设 processText 是同步或您在外部处理好了。
                // 如果是异步，通常建议在外部处理完分词再传进来，或者忽略复杂的异步分词
                // 这里简化处理：简单按空格分词模拟，实际项目请使用 await processText
                const words = b.comment.split(/[\s,，]+/);
                words.forEach((w) => {
                    if (w.length > 0)
                        newCommentStats[b.categoryId][w] =
                            (newCommentStats[b.categoryId][w] || 0) + 1;
                });
            }
        });

        // 第二次遍历：构建 Tensor 数据
        bills.forEach((b) => {
            inputs.push(extractFeatures(b.time, b.location, newBounds));
            labels.push(catToIndex[b.categoryId]);
        });

        // 2. 模型构建
        const xs = tf.tensor2d(inputs);
        const ys = tf.oneHot(
            tf.tensor1d(labels, "int32"),
            newCategoryMap.length,
        );

        const model = tf.sequential();
        // 输入层 + 隐藏层
        model.add(
            tf.layers.dense({ units: 16, activation: "relu", inputShape: [7] }),
        );
        model.add(tf.layers.dropout({ rate: 0.1 }));
        // 输出层
        model.add(
            tf.layers.dense({
                units: newCategoryMap.length,
                activation: "softmax",
            }),
        );

        model.compile({ optimizer: "adam", loss: "categoricalCrossentropy" });

        // 3. 训练
        await model.fit(xs, ys, { epochs: 20, batchSize: 32, verbose: 0 });

        // 4. 更新状态
        this.model = model;
        this.categoryMap = newCategoryMap;
        this.bounds = newBounds;
        this.commentStats = newCommentStats;

        // 5. 持久化
        await model.save(new IDBHandler(this.book));
        // 保存非 Tensor 数据
        const currentData = (await getItem(this.book)) || {};
        await setItem(this.book, {
            ...currentData,
            categoryMap: this.categoryMap,
            locationBounds: this.bounds,
            commentModel: this.commentStats,
        });

        xs.dispose();
        ys.dispose();
    }

    // 预测逻辑
    async predict(
        target: "category" | "comment",
        time: number,
        location?: GeoLocation,
        topN = 3,
    ): Promise<string[]> {
        if (!this.model || this.categoryMap.length === 0) return [];
        const tf = await loadTF();
        // 1. 预测分类概率
        const feat = extractFeatures(time, location, this.bounds);
        const input = tf.tensor2d([feat]);
        const predTensor = this.model.predict(input) as TFLib.Tensor;
        const probs = await predTensor.data();

        input.dispose();
        predTensor.dispose();

        // 排序获取 Top N 分类索引
        const sortedIndices = Array.from(probs)
            .map((p, i) => ({ p, i }))
            .sort((a, b) => b.p - a.p);

        const topCategories = sortedIndices
            .slice(0, topN)
            .map((x) => this.categoryMap[x.i]);

        if (target === "category") {
            return topCategories;
        } else {
            // 预测备注：基于“最可能的分类”去查高频词
            const bestCat = topCategories[0];
            if (!bestCat || !this.commentStats[bestCat]) return [];

            return Object.entries(this.commentStats[bestCat])
                .sort(([, a], [, b]) => b - a)
                .slice(0, topN)
                .map(([w]) => w);
        }
    }
}

// --- 导出对外 API (保持原有签名，增加 location 参数) ---

const predictors: Record<string, Predictor> = {};

async function getPredictor(book: string) {
    if (!predictors[book]) {
        predictors[book] = new Predictor(book);
        await predictors[book].init();
    }
    return predictors[book];
}

export const learn = async (book: string, bills: Bill[], meta?: any) => {
    const p = await getPredictor(book);
    await p.train(bills);
    console.log("start train");
};

export const predict = async (
    book: string,
    target: "category" | "comment",
    time: number,
    topN = 3,
    location?: GeoLocation, // 新增可选参数，兼容旧调用
): Promise<string[]> => {
    const p = await getPredictor(book);
    // 兼容旧代码未传 location 的情况
    return p.predict(target, time, location, topN);
};

export const clear = async () => {
    await clearDB();
    for (const key in predictors) delete predictors[key];
};
