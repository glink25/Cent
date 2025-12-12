// 我需要这样生成有关于typescript的合并策略
// 假设有一个原始对象O，它的值如下：
// ```javascript
// O = {
//     'name': '',
//     'items':[
//         {
//             name:1,
//             value:'2'
//         }
//     ],
//     'records':{
//         'someKey':{
//             'deepKey':1
//             'deepArray':[
//                 {
//             name:1,
//             value:'2'
//         }
//             ]
//         }
//     }
// }
// ```
// 然后有一个基于O变化后的新对象A，值如下：
// ```javascript
// O = {
//     'items':[
//         {
//             name:1,
//             value:'3'
//         }
//     ],
//     'records':{
//         'someKey':{
//             'deepKey':1
//             'deepArray':[
//             ]
//         }
//     }
// }
// ```
// 我需要得到O变化为A的patch，即通过 A = merge(O,patchA) 并且当有多个patch时，满足幂等策略： merge(merge(O,patchA),patchB) = merge(merge(O,patchB),patchA)
// 请注意，
// 1，O的初始结构是不固定的，并且在diff时，应该允许传入额外的metadata信息，这些信息不会影响merge的结果
// 2，数组的变动应该基于元素的id、key、name这些来确定，能够正确处理顺序变动和删改
// 能否给予jsondiffpatch第三方库帮我实现对应的 diff（ diff(O,A)=patchA ） 和 merge 函数？

import { create, type DiffPatcher } from "jsondiffpatch";
import { cloneDeep } from "lodash-es";

type AnyObject = Record<string, any>;
type Patch = any; // jsondiffpatch delta 类型（简化）

function createDiffPatcher(): DiffPatcher {
    return create({
        arrays: {
            detectMove: true,
            includeValueOnMove: true,
        },
        objectHash: (obj: any) => {
            if (!obj || typeof obj !== "object") return "";
            const keys = ["id", "key", "name", "uid", "_id"];
            for (const k of keys) {
                if (Object.hasOwn(obj, k)) {
                    const val = obj[k];
                    if (typeof val === "string" || typeof val === "number")
                        return String(val);
                }
            }
            try {
                return JSON.stringify(obj);
            } catch {
                return String(obj);
            }
        },
    });
}

/**
 * 安全去除 patch 根级元数据。
 * 不对数组（delta 根为数组）做任何处理。
 */
function stripMetadataFromPatch(patch: Patch): Patch {
    if (!patch || typeof patch !== "object") return patch;

    // 若 patch 根是数组，不要去破坏它（array delta）
    if (Array.isArray(patch)) return patch;

    // 若无 $$meta 也无需复制，直接返回
    if (!patch.$$meta && !Object.keys(patch).some((k) => k.startsWith("$"))) {
        return patch;
    }

    // 复制对象，但不复制数组结构（保留 delta 结构）
    const obj = { ...patch };
    delete obj.$$meta;
    for (const k of Object.keys(obj)) {
        if (k.startsWith("$")) delete obj[k];
    }

    return obj;
}

const deepClone = cloneDeep;

export function diff(
    original: AnyObject,
    modified: AnyObject,
    meta?: AnyObject,
): Patch | null {
    const dp = createDiffPatcher();
    const delta = dp.diff(original, modified);
    if (!delta) return null;
    if (meta && typeof meta === "object") {
        (delta as AnyObject).$$meta = deepClone(meta);
    }
    return delta;
}

/**
 * 安全 merge：
 *   - 禁止 patch 根是数组（否则 jsondiffpatch 会把整个对象替换掉）
 *   - 正确排序
 *   - 保留 patch 原始 delta 结构
 */
export function merge(
    base: AnyObject,
    patch: Patch,
    options?: { preferHigherPriority?: boolean },
): AnyObject {
    const dp = createDiffPatcher();

    // 整理与排序
    const normalized = (() => {
        const meta =
            patch && typeof patch === "object" ? patch.$$meta || null : null;
        const keyPriority =
            meta && typeof meta.priority !== "undefined"
                ? Number(meta.priority)
                : null;
        return {
            orig: patch,
            noMeta: stripMetadataFromPatch(patch),
            keyPriority,
        };
    })();

    const result = deepClone(base);

    // ❗禁止根 delta 是数组（否则整个对象会被替换）
    if (Array.isArray(normalized.noMeta)) {
        throw new Error(
            "Patch root cannot be an array delta. Wrap patch inside an object.",
        );
    }

    try {
        dp.patch(result, normalized.noMeta);
    } catch (err) {
        throw new Error("Failed to apply patch during merge: " + String(err));
    }

    return result;
}
