import { OncentDbClient } from "../lib";
import { getToken } from "./login";

const repo = new OncentDbClient({
	auth: getToken,
	repoPrefix: "oncent-journal",
	collectionName: "ledger",
});
export const StorageAPI = repo;
