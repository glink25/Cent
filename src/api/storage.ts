import type { Bill } from "@/ledger/type";
import { Gitray } from "../gitray";
import { getToken } from "./login";

const repo = new Gitray<Bill>({
	auth: getToken,
	repoPrefix: "oncent-journal",
	entryName: "ledger",
});
export const StorageAPI = repo;
