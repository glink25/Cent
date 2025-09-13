import { wrap } from "comlink";
import { Gitray } from "@/gitray";

import type { Bill, BillCategory } from "@/ledger/type";
import { getToken } from "../login";
import type { Exposed } from "./woker";
import DeferredWorker from "./woker?worker";

export type GlobalMeta = {
	customCategories?: BillCategory[];
};

export type PersonalMeta = any;

const config = {
	repoPrefix: "oncent-journal",
	entryName: "ledger",
	orderKeys: ["time"],
};

const repo = new Gitray<Bill, { time: number }>({
	...config,
	auth: getToken,
});

export const StorageAPI = repo;

// ComlinkSharedWorker

const workerInstance = new DeferredWorker({
	/* normal Worker options*/
},
);
const StorageDeferredAPI = wrap<Exposed>(workerInstance)

export { StorageDeferredAPI }

StorageDeferredAPI.init(config);