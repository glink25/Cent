import { type DBSchema, openDB } from "idb";
import type { ZenSessionState } from "./types";

const DB_NAME = "cent-zen-session-history";
const DB_VERSION = 1;
const STORE_NAME = "sessions";

interface ZenSessionDB extends DBSchema {
    [STORE_NAME]: {
        key: string;
        value: ZenSessionState & { key: string };
        indexes: {
            updatedAt: number;
        };
    };
}

async function getDB() {
    return openDB<ZenSessionDB>(DB_NAME, DB_VERSION, {
        upgrade(db) {
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: "key",
                });
                store.createIndex("updatedAt", "updatedAt");
            }
        },
    });
}

export async function getZenSession(key: string) {
    const db = await getDB();
    const session = await db.get(STORE_NAME, key);
    db.close();
    if (!session) return undefined;
    const { key: _key, ...value } = session;
    return value;
}

export async function putZenSession(key: string, session: ZenSessionState) {
    const db = await getDB();
    await db.put(STORE_NAME, { ...session, key });
    db.close();
}

export async function deleteZenSession(key: string) {
    const db = await getDB();
    await db.delete(STORE_NAME, key);
    db.close();
}
