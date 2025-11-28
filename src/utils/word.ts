const WASM_URL =
    "https://cdn.jsdelivr.net/npm/jieba-wasm@2.4.0/pkg/web/jieba_rs_wasm_bg.wasm";

type JiebaLib = {
    cut: (text: string, x: boolean) => string[];
};

let jiebaModuleLoaded: Promise<JiebaLib> | undefined;

// 中文停用词列表 (不变)
export const STOP_WORDS = new Set([
    "的",
    "了",
    "和",
    "是",
    "就",
    "都",
    "而",
    "及",
    "与",
    "在",
    "这",
    "那",
    "有",
    "我",
    "你",
    "他",
    "她",
    "它",
    "们",
    "个",
    "上",
    "下",
    "之",
    "用",
    "等",
    "来",
    "去",
    "说",
    "着",
    "让",
    "到",
    "为",
    "把",
    "被",
    "或",
    "且",
    "一个",
    "没有",
    "我们",
    "你们",
    "他们",
    "这里",
    "那里",
    "但是",
    "因为",
    "所以",
    "，",
    "。",
    "！",
    "？",
    "：",
    "；",
    "“",
    "”",
    "（",
    "）",
    "、",
    "\n",
    " ",
]);

export const ignoredWords = ["alipay", "wechat", "yy"];

const reText = <T extends string | undefined>(v: T) =>
    ignoredWords.reduce<T>((prev, c) => prev?.replaceAll(c, " ") as T, v);

export async function initializeWasm() {
    if (jiebaModuleLoaded) {
        return jiebaModuleLoaded;
    }

    console.log("正在动态加载 jieba-wasm...");
    jiebaModuleLoaded = (async () => {
        const module = await import(
            // @ts-expect-error
            "https://cdn.jsdelivr.net/npm/jieba-wasm@2.4.0/pkg/web/jieba_rs_wasm.js"
        );

        // 2. 初始化 WASM，传入 WASM 文件的 URL
        await module.default(WASM_URL);
        return module;
    })();
    return jiebaModuleLoaded;
}

/**
 * 对文本进行分词、词频统计和过滤。
 * @param {string} text - 输入的原始文本。
 * @param {number} topN - 返回前 N 个高频词。
 */
export async function processText(text: string | string[], topN = 150) {
    const jiebaModule = await initializeWasm();

    // 从已存储的模块对象中调用 cut 函数
    const words = Array.isArray(text)
        ? text.flatMap((txt) => jiebaModule.cut(reText(txt), true))
        : jiebaModule.cut(reText(text), true);

    // ... (词频统计、过滤和排序逻辑保持不变) ...
    const freqMap = new Map<string, number>();
    words.forEach((word) => {
        if (word.length > 1 && !STOP_WORDS.has(word) && !/^\s+$/.test(word)) {
            freqMap.set(word, (freqMap.get(word) || 0) + 1);
        }
    });

    const list = Array.from(freqMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, topN);

    return list;
}
