import { BillIndexedDBStorage } from "@/database/storage";
import { t } from "@/locale";
import type { ZenPost } from "@/zen/types";
import type { SyncEndpointFactory } from "../type";
import { OfflineStorage } from "./core";

const ZEN_ENTRY_NAME = "zen";

const Me = {
    id: "me",
    name: "Me",
    avatar_url: "/icon.png",
    // "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
};

export const OfflineEndpoint: SyncEndpointFactory = {
    type: "offline",
    name: "offline",
    login: () => {
        localStorage.setItem("SYNC_ENDPOINT", "offline");
        location.reload();
    },
    manuallyLogin: undefined,
    init: ({ modal }) => {
        const repo = new OfflineStorage({
            storage: (name) => new BillIndexedDBStorage(`book-${name}`),
        });
        const zenRepo = new OfflineStorage<ZenPost>({
            storage: (name) =>
                new BillIndexedDBStorage(`book-${name}--${ZEN_ENTRY_NAME}`),
        });
        return {
            logout: async () => {
                // 暂时不清除本地数据
                return;
            },
            getUserInfo: async () => {
                return Me;
            },
            getCollaborators: async () => [Me],
            getOnlineAsset: undefined,

            fetchAllBooks: repo.fetchAllStore.bind(repo),
            createBook: repo.createStore.bind(repo),
            initBook: async (name) => {
                await Promise.all([
                    repo.initStore(name),
                    zenRepo.initStore(name),
                ]);
            },
            deleteBook: async (name) => {
                await modal.prompt({ title: t("delete-book-offline-tip") });
                await zenRepo.deleteStore(name);
                return repo.deleteStore(name);
            },
            inviteForBook: undefined,

            batch: repo.batch.bind(repo),
            getMeta: repo.getMeta.bind(repo),
            getAllItems: repo.getAllItems.bind(repo),
            onChange: repo.onChange.bind(repo),

            batchZen: zenRepo.batch.bind(zenRepo),
            getAllZenItems: zenRepo.getAllItems.bind(zenRepo),
            onZenChange: zenRepo.onChange.bind(zenRepo),

            getIsNeedSync: repo.getIsNeedSync.bind(repo),
            onSync: repo.onSync.bind(repo),
            toSync: repo.toSync.bind(repo),
        };
    },
};
