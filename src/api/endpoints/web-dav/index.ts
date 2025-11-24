import type { WebDAVEdit } from "@/components/modal/web-dav";
import { BillIndexedDBStorage } from "@/database/storage";
import type { Bill } from "@/ledger/type";
import type { SyncEndpointFactory } from "../type";
import { WebDAVSync } from "./core";

const config = {
    repoPrefix: "cent-journal",
    entryName: "ledger",
    orderKeys: ["time"],
};
const key = "web-dav-config";

const getAuth = () => {
    const data = localStorage.getItem(key);
    if (!data) {
        return;
    }
    const parsed = JSON.parse(data);
    return parsed as WebDAVEdit;
};

export const WebDAVEndpoint: SyncEndpointFactory = {
    type: "webdav",
    name: "webdav",
    login: async ({ modal }) => {
        const auth = await modal.webDavAuth({
            check: async (data) => {
                const remote = data.remote.replace(/\/$/, "");
                await WebDAVSync.checkConfig({
                    remoteUrl: remote,
                    username: data.username,
                    password: data.password,
                    proxy: data.proxy,
                }).catch((error) => {
                    modal.toast.error(
                        (error as Error)?.message ?? JSON.stringify(error),
                    );
                    return Promise.reject(error);
                });
            },
        });
        if (!auth) {
            return;
        }

        localStorage.setItem("SYNC_ENDPOINT", "webdav");
        localStorage.setItem("web-dav-config", JSON.stringify(auth));
        location.reload();
    },
    manuallyLogin: undefined,
    init: () => {
        const auth = getAuth();
        if (!auth) {
            throw new Error("web dav auth not found");
        }
        const remote = auth.remote.replace(/\/$/, "");
        const repo = new WebDAVSync<Bill>({
            ...config,
            username: auth.username,
            password: auth.password,
            customUserName: auth.customUserName,
            remoteUrl: remote,
            proxy: auth.proxy,
            storage: (name) => new BillIndexedDBStorage(`book-${name}`),
        });
        const toBookName = (bookId: string) => {
            return bookId.replace(`${config.repoPrefix}-`, "");
        };

        return {
            logout: async () => {
                await repo.dangerousClearAll();
                return;
            },
            getUserInfo: async () => {
                const Me = {
                    id: auth.customUserName || auth.username,
                    name: auth.customUserName || auth.username,
                    avatar_url: "/icon.png",
                };
                return Me;
            },
            getCollaborators: async (id) => {
                const aliases = await repo.getUserAliases(id);
                const Me = {
                    id: auth.username,
                    name: auth.username,
                    avatar_url: "/icon.png",
                };
                const users = [
                    Me,
                    ...aliases
                        .filter((a) => a !== Me.name)
                        .map((alias) => ({
                            id: alias,
                            name: alias,
                            avatar_url: "/icon.png",
                        })),
                ];
                return users;
            },
            getOnlineAsset: async (url) => {
                return repo.getOnlineAsset(url);
            },
            fetchAllBooks: async () => {
                const res = await repo.fetchAllStore();
                return res.map((v) => ({ id: v, name: toBookName(v) }));
            },
            createBook: repo.createStore.bind(repo),
            initBook: repo.initStore.bind(repo),
            deleteBook: async () => {
                confirm(
                    "Please delete this folder on your Web DAV server/app manually",
                );
            },
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
