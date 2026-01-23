interface SmartLogOptions {
    maxStringLen?: number; // 字符串最大长度
    maxArrayItems?: number; // 数组最多显示的元素数
    maxDepth?: number; // 递归深度
    maxKeys?: number; // 对象最多显示的键数
}

export function smartLog(obj: unknown, options: SmartLogOptions = {}): string {
    const {
        maxStringLen = 50, // 字符串最大长度
        maxArrayItems = 20, // 数组最多显示的元素数
        maxDepth = 3, // 递归深度
        maxKeys = 20, // 对象最多显示的键数
    } = options;

    const seen = new WeakSet<object>();

    function serialize(val: unknown, depth: number): string {
        // 1. 处理基础类型
        if (typeof val === "string") {
            return val.length > maxStringLen
                ? `${val.substring(0, maxStringLen)}...(${val.length} chars)`
                : val;
        }
        if (typeof val !== "object" || val === null) {
            return String(val);
        }

        // 此时 val 一定是 object 类型（非 null）
        const obj = val as Record<string, unknown>;

        // 2. 处理循环引用
        if (seen.has(obj)) return "[Circular]";
        if (depth >= maxDepth)
            return Array.isArray(obj) ? "[Array]" : "[Object]";
        seen.add(obj);

        // 3. 处理数组
        if (Array.isArray(obj)) {
            const length = obj.length;
            if (length <= maxArrayItems) {
                return `Array(${length}) [${obj.map((v) => serialize(v, depth + 1)).join(", ")}]`;
            }
            const items = obj
                .slice(0, maxArrayItems)
                .map((v) => serialize(v, depth + 1));
            return `Array(${length}) [${items.join(", ")}, ... +${length - maxArrayItems} more]`;
        }

        // 4. 处理对象
        const keys = Object.keys(obj);
        const length = keys.length;
        const slicedKeys = keys.slice(0, maxKeys);
        const props = slicedKeys.map(
            (k) => `${k}: ${serialize(obj[k], depth + 1)}`,
        );

        if (length > maxKeys) {
            props.push(`... +${length - maxKeys} more`);
        }

        return `{ ${props.join(", ")} }`;
    }

    return serialize(obj, 0);
}

// --- 测试 ---
// const bigData = {
//     id: "1234567890abcdef1234567890abcdef",
//     content: "这是一段非常长的文本内容，目的是为了测试大模型调试时的字符串截断功能是否正常工作...",
//     users: new Array(100).fill({ name: "User", age: 25 }),
//     metadata: {
//         tags: ["js", "debug", "llm", "token", "optimization"],
//         nested: { a: 1, b: 2, c: { d: 4 } }
//     }
// };

// console.log(smartLog(bigData));
