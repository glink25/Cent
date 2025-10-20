import { wrap } from "comlink";
import type { BillTag } from "@/components/bill-tag/type";
import type { Budget } from "@/components/budget/type";
import type { Full } from "@/database/stash";
import type { Bill, BillCategory, BillFilter } from "@/ledger/type";
import { EmptyEndpoint } from "../endpoints/empty";
import { GithubEndpoint } from "../endpoints/github";
import { OfflineEndpoint } from "../endpoints/offline";
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

const SYNC_ENDPOINT_KEY = "SYNC_ENDPOINT";
const type = localStorage.getItem(SYNC_ENDPOINT_KEY) ?? "github";

const _StorageAPI =
    type === "github"
        ? GithubEndpoint
        : type === "offline"
          ? OfflineEndpoint
          : EmptyEndpoint;
const actions = _StorageAPI.init();

export const StorageAPI = {
    name: _StorageAPI.name,
    type: _StorageAPI.type,
    ...actions,
    loginWith: (type: string) => {
        if (type === "github") {
            return GithubEndpoint.login();
        }
        if (type === "offline") {
            return OfflineEndpoint.login();
        }
    },
    loginManuallyWith: (type: string) => {
        if (type === "github") {
            return GithubEndpoint.manuallyLogin?.();
        }
    },
};

// ComlinkSharedWorker

const workerInstance = new DeferredWorker({
    /* normal Worker options*/
});
const StorageDeferredAPI = wrap<Exposed>(workerInstance);

export { StorageDeferredAPI };
