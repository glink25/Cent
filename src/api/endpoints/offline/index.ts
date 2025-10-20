import { BillIndexedDBStorage } from "@/database/storage";
import type { SyncEndpointFactory } from "../type";
import { OfflineStorage } from "./core";

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
    init: () => {
        const repo = new OfflineStorage({
            storage: (name) => new BillIndexedDBStorage(`book-${name}`),
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
            initBook: repo.initStore.bind(repo),
            deleteBook: repo.deleteStore.bind(repo),
            inviteForBook: undefined,

            batch: repo.batch.bind(repo),
            getMeta: repo.getMeta.bind(repo),
            getAllItems: repo.getAllItems.bind(repo),
            onChange: repo.onChange.bind(repo),

            getIsNeedSync: repo.getIsNeedSync.bind(repo),
            onSync: repo.onSync.bind(repo),
            toSync: repo.toSync.bind(repo),
        };
    },
};
