import type { Bill } from "@/ledger/type";
import { createIndexedDBStorage, Gitray } from "../gitray";
import { getToken } from "./login";

const cacheStorage = await createIndexedDBStorage();

const repo = new Gitray<Bill>({
	auth: getToken,
	repoPrefix: "oncent-journal",
	collectionName: "ledger",
	cache: {
		storage: cacheStorage,
		ttl: 24 * 60 * 60 * 1000, // 24hour
	},
});
export const StorageAPI = repo;
