import { wrap } from "comlink";
import { BillIndexeBDStorage, Gitray } from "@/gitray";

import type { Bill, BillCategory, BillFilter } from "@/ledger/type";
import { getToken } from "../login";
import type { Exposed } from "./woker";
import DeferredWorker from "./woker?worker";

export type GlobalMeta = {
	customCategories?: BillCategory[];
	customFilters?: { id: string; filter: BillFilter; name: string }[];
};

const config = {
	repoPrefix: "oncent-journal",
	entryName: "ledger",
	orderKeys: ["time"],
};

const repo = new Gitray<Bill>({
	...config,
	auth: getToken,
	storage: (name) => new BillIndexeBDStorage(`book-${name}`)
});

export const StorageAPI = repo;

// ComlinkSharedWorker

const workerInstance = new DeferredWorker({
	/* normal Worker options*/
});
const StorageDeferredAPI = wrap<Exposed>(workerInstance);

export { StorageDeferredAPI };

StorageDeferredAPI.init(config);
