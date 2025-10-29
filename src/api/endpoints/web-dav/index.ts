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
    return parsed as {
        remote: string;
        username: string;
        password: string;
        proxy?: string;
    };
};

export const WebDAVEndpoint: SyncEndpointFactory = {
    type: "webdav",
    name: "webdav",
    login: async ({ modal }) => {
        const auth = await modal.webDavAuth({
            check: async (data) => {
                const remote = data.remote.replace(/\/$/, "");
                const remoteUrl = data.proxy
                    ? `${data.proxy}${encodeURIComponent(remote)}`
                    : remote;
                await WebDAVSync.checkConfig({
                    remoteUrl,
                    username: data.username,
                    password: data.password,
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
        const remoteUrl = auth.proxy
            ? `${auth.proxy}${encodeURIComponent(remote)}`
            : remote;
        const repo = new WebDAVSync<Bill>({
            ...config,
            username: auth.username,
            password: auth.password,
            remoteUrl,
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
                return {
                    id: auth.username,
                    name: auth.username,
                    avatar_url: "/icon.png",
                };
            },
            getCollaborators: async () => [
                {
                    id: auth.username,
                    name: auth.username,
                    avatar_url: "/icon.png",
                },
            ],
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
                confirm("are you sure to delete?");
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
