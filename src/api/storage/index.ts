import { wrap } from "comlink";
import type { BillTag } from "@/components/bill-tag/type";
import type { Budget } from "@/components/budget/type";
import type { Full } from "@/database/stash";
import type { Bill, BillCategory, BillFilter } from "@/ledger/type";
import { createEmptyEndpoint } from "../endpoints/empty";
import { createGithubEndpoint } from "../endpoints/github";
import type { Exposed } from "./worker";
import DeferredWorker from "./worker?worker";

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

export type ExportedJSON = {
    items: Full<Bill>[];
    meta: GlobalMeta;
};

const config = {
    repoPrefix: "cent-journal",
    entryName: "ledger",
    orderKeys: ["time"],
};

const SYNC_ENDPOINT_KEY = "SYNC_ENDPOINT";
const type = localStorage.getItem(SYNC_ENDPOINT_KEY) ?? "github";

export const StorageAPI =
    type === "github"
        ? createGithubEndpoint(config)
        : createEmptyEndpoint(config);

// ComlinkSharedWorker

const workerInstance = new DeferredWorker({
    /* normal Worker options*/
});
const StorageDeferredAPI = wrap<Exposed>(workerInstance);

export { StorageDeferredAPI };

StorageDeferredAPI.init(config);
