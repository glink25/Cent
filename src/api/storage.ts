import type { Bill } from "@/ledger/type";
import { Gitray } from "../gitray";
import { getToken } from "./login";

const repo = new Gitray<Bill, { time: number }>({
	auth: getToken,
	repoPrefix: "oncent-journal",
	entryName: "ledger",
	orderKeys: ["time"],
});
export const StorageAPI = repo;
