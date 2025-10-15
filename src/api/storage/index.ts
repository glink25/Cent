import { wrap } from "comlink";
import type { BillTag } from "@/components/bill-tag/type";
import type { Budget } from "@/components/budget/type";
import { BillIndexeBDStorage, Gitray } from "@/gitray";
import type { Bill, BillCategory, BillFilter } from "@/ledger/type";
import { getToken } from "../login";
import type { Exposed } from "./woker";
import DeferredWorker from "./woker?worker";

export type PersonalMeta = {
    names?: Record<string, string>;
};

export type GlobalMeta = {
    customFilters?: { id: string; filter: BillFilter; name: string }[];
    budgets?: Budget[];
    categories?: BillCategory[];
    tags: BillTag[];
    personal?: Record<string, PersonalMeta>;
};

const config = {
    repoPrefix: "cent-journal",
    entryName: "ledger",
    orderKeys: ["time"],
};

const repo = new Gitray<Bill>({
    ...config,
    auth: getToken,
    storage: (name) => new BillIndexeBDStorage(`book-${name}`),
});

export const toBookName = (bookId: string) => {
    const [owner, repo] = bookId.split("/");
    return repo.replace(`${config.repoPrefix}-`, "");
};

export const StorageAPI = repo;

// ComlinkSharedWorker

const workerInstance = new DeferredWorker({
    /* normal Worker options*/
});
const StorageDeferredAPI = wrap<Exposed>(workerInstance);

export { StorageDeferredAPI };

StorageDeferredAPI.init(config);
