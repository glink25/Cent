import { wrap } from "comlink";
import { EmptyEndpoint } from "../endpoints/empty";
import { GithubEndpoint } from "../endpoints/github";
import { OfflineEndpoint } from "../endpoints/offline";
import type { Exposed } from "./worker";
import DeferredWorker from "./worker?worker";

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
