import { cloneDeep, isEqual, isPlainObject } from "lodash-es";

type AnyObject = Record<string, any>;

/**
 * Diff 算法：递归寻找变化
 */
export function diff<T extends AnyObject, U extends AnyObject>(
    oldObj: T,
    newObj: U,
    meta?: any,
): AnyObject {
    const patch: AnyObject = { $$patch: true, ...meta };

    // 遍历新对象的所有 key
    for (const key in newObj) {
        if (Object.hasOwn(newObj, key)) {
            const oldValue = oldObj[key];
            const newValue = newObj[key];

            // 1. 如果新旧值相等，跳过
            if (isEqual(oldValue, newValue)) {
                continue;
            }

            // 2. 如果新值是纯对象（且不是数组），则递归比对
            if (isPlainObject(newValue) && isPlainObject(oldValue)) {
                const deepDiff = diff(oldValue, newValue);

                // 只有当深层比对确实产生了差异（除了 $$patch 标志位以外有其他 key）时才记录
                if (Object.keys(deepDiff).length > 1) {
                    patch[key] = deepDiff;
                }
            } else {
                // 3. 如果新值是数组、基础类型或旧值不是对象，直接覆盖新值
                // 注意：根据要求，数组被看作整体，不需要 diff 内部
                patch[key] = newValue;
            }
        }
    }

    return patch;
}

/**
 * Merge 算法：将 patch 合并到目标对象
 */
export function merge<T extends AnyObject>(target: T, patch: AnyObject): T {
    // 浅拷贝 target 防止污染原对象（根据需求可选）
    const result = cloneDeep(target);

    for (const key in patch) {
        if (key === "$$patch") continue;

        const patchValue = patch[key];

        // 如果 patchValue 是带 $$patch 标志的对象，说明需要递归合并
        if (isPlainObject(patchValue) && patchValue.$$patch) {
            (result as any)[key] = merge(result[key] || {}, patchValue);
        } else {
            // 否则直接覆盖（包括数组和普通值）
            (result as any)[key] = patchValue;
        }
    }

    return result;
}
