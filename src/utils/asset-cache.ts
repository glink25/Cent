/**
 * IndexedDB-based asset cache for online resources
 * Provides persistent caching without Service Worker complexity
 */

interface CacheEntry {
    key: string;
    blob: Blob;
    timestamp: number;
    url?: string; // Optional URL for debugging
}

class AssetCache {
    private db: IDBDatabase | null = null;
    private readonly dbName = "asset-cache";
    private readonly storeName = "assets";
    private readonly maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days

    async init(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: "key" });
                    store.createIndex("timestamp", "timestamp", { unique: false });
                }
            };
        });
    }

    async get(key: string): Promise<Blob | null> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const entry: CacheEntry | undefined = request.result;
                if (!entry) {
                    resolve(null);
                    return;
                }

                // Check if entry is expired
                if (Date.now() - entry.timestamp > this.maxAge) {
                    this.delete(key).catch(console.error);
                    resolve(null);
                    return;
                }

                resolve(entry.blob);
            };
        });
    }

    async set(key: string, blob: Blob, url?: string): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);

            const entry: CacheEntry = {
                key,
                blob,
                timestamp: Date.now(),
                url,
            };

            const request = store.put(entry);
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async delete(key: string): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async clear(): Promise<void> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], "readwrite");
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    async getStats(): Promise<{ count: number; size: number }> {
        if (!this.db) await this.init();

        return new Promise((resolve, reject) => {
            const transaction = this.db!.transaction([this.storeName], "readonly");
            const store = transaction.objectStore(this.storeName);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const entries: CacheEntry[] = request.result;
                let totalSize = 0;
                for (const entry of entries) {
                    totalSize += entry.blob.size;
                }
                resolve({
                    count: entries.length,
                    size: totalSize,
                });
            };
        });
    }
}

// Global cache instance
export const assetCache = new AssetCache();