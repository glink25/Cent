/**
 * 高阶函数：为异步方法添加单例缓存。
 * * @param fn 需要添加缓存的异步函数。
 * @returns 带有缓存逻辑的新函数。
 */
export function asyncSingleton<T extends (...args: any[]) => Promise<any>>(
    fn: T,
): T {
    // 每个被包装的函数都拥有自己的独立缓存
    const cache = new Map<string, Promise<any>>();

    // 返回一个新的函数，它将包含缓存逻辑
    return async function (...args: any[]) {
        // 使用参数的 JSON 字符串作为缓存键
        const key = JSON.stringify(args);

        // 如果缓存中存在，直接返回缓存的 Promise
        if (cache.has(key)) {
            // console.log(`Cache hit for key: ${key}`);
            return cache.get(key);
        }

        // 调用原始函数并获取 Promise
        // @ts-expect-error
        const promise = fn.apply(this, args);

        // 将 Promise 存入缓存
        cache.set(key, promise);

        // 等待 Promise 完成（无论成功或失败），然后从缓存中清除
        promise.finally(() => {
            // console.log(`Cache cleared for key: ${key}`);
            cache.delete(key);
        });

        // 返回原始 Promise
        return promise;
    } as T;
}

// 示例
// class MyService {
//     // 定义一个异步方法，但不要直接使用它
//     private async _fetchData(id: string): Promise<string> {
//         console.log(`Executing request for id: ${id}`);
//         await new Promise(resolve => setTimeout(resolve, 2000));
//         return `Data for id: ${id}`;
//     }

//     // 使用高阶函数包装 _fetchData，并将其赋值给公共方法
//     public fetchData = asyncSingleton(this._fetchData.bind(this));

//     // 另一个需要缓存的方法，它将拥有自己的独立缓存
//     private async _fetchAnotherData(name: string): Promise<string> {
//         console.log(`Executing request for name: ${name}`);
//         await new Promise(resolve => setTimeout(resolve, 1500));
//         return `Another data for name: ${name}`;
//     }

//     public fetchAnotherData = asyncSingleton(this._fetchAnotherData.bind(this));
// }

// const service = new MyService();

// // 第一次调用 fetchData
// service.fetchData('123').then(data => console.log('Result 1:', data));

// // 立即再次调用 fetchData，会命中缓存
// service.fetchData('123').then(data => console.log('Result 2:', data));

// // 调用不同参数，会触发新的请求
// service.fetchData('456').then(data => console.log('Result 3:', data));

// // 稍后调用 fetchAnotherData，验证其缓存是独立的
// setTimeout(() => {
//     console.log('\n--- Calling fetchAnotherData ---');
//     service.fetchAnotherData('A').then(data => console.log('Another Result 1:', data));
//     service.fetchAnotherData('A').then(data => console.log('Another Result 2:', data)); // 命中缓存
// }, 3000);
