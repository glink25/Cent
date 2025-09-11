import { type DBSchema, openDB } from "idb";

async function storeExists(dbName: string, storeName: string) {
	return new Promise((resolve) => {
		const req = indexedDB.open(dbName);
		req.onsuccess = () => {
			const db = req.result;
			const exists = db.objectStoreNames.contains(storeName);
			db.close();
			resolve(exists);
		};
		req.onerror = () => resolve(false);
	});
}

export async function getCurrentVersion(dbName: string) {
	return new Promise<number>((resolve, reject) => {
		const req = indexedDB.open(dbName);
		req.onsuccess = () => {
			const db = req.result;
			const version = db.version;
			db.close();
			resolve(version);
		};
		req.onerror = () => reject(req.error);
	});
}

/**
 * getOrCreateStore
 * @param {string} dbName - 数据库名称
 * @param {string} storeName - 要获取或创建的 object store 名称
 * @param {object} [options] - 可选参数：{ keyPath, autoIncrement }
 * @returns {Promise<IDBPDatabase>}
 */
export async function getOrCreateStore<DB>(
	dbName: string,
	storeName: string,
	options?: IDBObjectStoreParameters,
) {
	const exists = await storeExists(dbName, storeName);
	if (!exists) {
		const currentVersion = await getCurrentVersion(dbName);
		const newVersion = currentVersion + 1;
		return openDB<DB>(dbName, newVersion, {
			upgrade(db) {
				if (!db.objectStoreNames.contains(storeName as any)) {
					db.createObjectStore(storeName as any, options);
				}
			},
		});
	} else {
		return openDB<DB>(dbName);
	}
}
