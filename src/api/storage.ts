import { createIndexedDBStorage, OncentDbClient } from "../lib";
import { getToken } from "./login";

const storage = await createIndexedDBStorage();
const repo = new OncentDbClient({
	auth: getToken,
	repoPrefix: "oncent-journal",
	collectionName: "ledger",
	cache: {
		storage,
		ttl: 24 * 60 * 60 * 1000, // 24hour
	},
});
export const StorageAPI = repo;
