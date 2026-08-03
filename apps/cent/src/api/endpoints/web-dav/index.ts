import type { WebDAVEdit } from "@/components/modal/web-dav";
import { Scheduler } from "@/database/scheduler";
import { BillIndexedDBStorage } from "@/database/storage";
import type { Bill, GlobalMeta } from "@/ledger/type";
import { createTidal } from "@/tidal";
import {
    checkWebDAVConfig,
    createWebDAVSyncer,
    fetchWebDAVUserIds,
} from "@/tidal/web-dav";
import type { ZenPost } from "@/zen/types";
import type { SyncEndpointFactory } from "../type";

const ZEN_ENTRY_NAME = "zen";

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

type WebDAVPrivateMeta = {
    _webDAVUserAliases?: string[];
};

type WebDAVMeta = WebDAVPrivateMeta & GlobalMeta;

const restoreUserIdType = (userId: string) => {
    return /^\d+$/.test(userId) ? Number(userId) : userId;
};

export const WebDAVEndpoint: SyncEndpointFactory = {
    type: "webdav",
    name: "webdav",
    login: async ({ modal }) => {
        const auth = await modal.webDavAuth({
            check: async (data) => {
                const remote = data.remote.replace(/\/$/, "");
                await checkWebDAVConfig({
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

                const userIds = await fetchWebDAVUserIds({
                    remoteUrl: remote,
                    username: data.username,
                    password: data.password,
                    proxy: data.proxy,
                });
                if (userIds.length === 0) {
                    data.userId = crypto.randomUUID();
                } else if (userIds.length === 1) {
                    data.userId = restoreUserIdType(userIds[0]);
                } else {
                    const selection = await modal.webDavUser({ userIds });
                    data.userId =
                        selection.type === "new"
                            ? crypto.randomUUID()
                            : restoreUserIdType(selection.userId);
                }
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
    init: ({ modal }) => {
        const auth = getAuth();
        if (!auth) {
            throw new Error("web dav auth not found");
        }
        const remote = auth.remote.replace(/\/$/, "");
        const webDAVSyncerConfig = {
            username: auth.username,
            password: auth.password,
            remoteUrl: remote,
            proxy: auth.proxy,
            userId: auth.userId,
            displayName: auth.customUserName,
        };
        const repo = createTidal<Bill>({
            storageFactory: (name) => new BillIndexedDBStorage(`book-${name}`),
            entryName: config.entryName,
            syncerFactory: () =>
                createWebDAVSyncer({
                    ...config,
                    ...webDAVSyncerConfig,
                }),
        });
        const zenRepo = createTidal<ZenPost>({
            storageFactory: (name) =>
                new BillIndexedDBStorage(`book-${name}--${ZEN_ENTRY_NAME}`),
            entryName: ZEN_ENTRY_NAME,
            syncerFactory: () =>
                createWebDAVSyncer({
                    ...config,
                    ...webDAVSyncerConfig,
                    entryName: ZEN_ENTRY_NAME,
                }),
        });
        const toBookName = (bookId: string) => {
            return bookId.replace(`${config.repoPrefix}-`, "");
        };

        const getUserAliases = async (storeName: string) => {
            const meta: WebDAVPrivateMeta | undefined =
                await repo.getMeta(storeName);
            if (!meta?._webDAVUserAliases) {
                return [];
            }
            return meta._webDAVUserAliases;
        };

        // ledger 与 zen 顺序同步，保持单一上传通道
        const scheduler = new Scheduler(async (signal) => {
            const [ledgerFinished, cancelLedger] = repo.sync();
            signal.onabort = cancelLedger;
            await ledgerFinished;
            const [zenFinished, cancelZen] = zenRepo.sync();
            signal.onabort = cancelZen;
            await zenFinished;
        });

        return {
            logout: async () => {
                await repo.detach();
                await zenRepo.detach();
            },
            getUserInfo: repo.getUserInfo,
            getCollaborators: async (id) => {
                const aliases = await getUserAliases(id);
                const Me = {
                    id: (auth.userId ?? auth.username) as unknown as string,
                    name: auth.customUserName || auth.username,
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
            getOnlineAsset: (src, store) => repo.getAsset(src, store),
            fetchAllBooks: async () => {
                const res = await repo.fetchAllStore();
                return res.map((v) => ({ id: v, name: toBookName(v) }));
            },
            createBook: repo.create,
            initBook: async (name) => {
                await Promise.all([repo.init(name), zenRepo.init(name)]);
                repo.getMeta(name).then((meta?: WebDAVMeta) => {
                    const customUserName = auth.customUserName;
                    const userId = auth.userId;
                    const newMeta = meta ?? ({} as WebDAVMeta);
                    let needsUpdate = false;

                    if (
                        userId !== undefined &&
                        !newMeta.personal?.[userId]
                    ) {
                        newMeta.personal = {
                            ...newMeta.personal,
                            [userId]: {},
                        };
                        needsUpdate = true;
                    }

                    if (
                        customUserName &&
                        !newMeta._webDAVUserAliases?.includes(customUserName)
                    ) {
                        newMeta._webDAVUserAliases = [
                            ...(newMeta._webDAVUserAliases ?? []),
                            customUserName,
                        ];
                        needsUpdate = true;
                    }

                    if (needsUpdate) {
                        repo.batch(name, [
                            {
                                type: "meta",
                                metaValue: newMeta,
                            },
                        ]);
                    }
                });
            },
            deleteBook: async () => {
                await modal.prompt({
                    title: "Please delete this folder on your Web DAV server/app manually",
                });
            },
            inviteForBook: undefined,

            batch: async (...args) => {
                await repo.batch(...args);
                scheduler.schedule();
            },
            getMeta: repo.getMeta,
            getAllItems: repo.getAllItems,
            onChange: repo.onChange,

            batchZen: async (...args) => {
                await zenRepo.batch(...args);
                scheduler.schedule();
            },
            getAllZenItems: zenRepo.getAllItems,
            onZenChange: zenRepo.onChange,

            getIsNeedSync: async () =>
                (await repo.hasStashes()) || (await zenRepo.hasStashes()),
            onSync: scheduler.onProcess.bind(scheduler),
            toSync: scheduler.schedule.bind(scheduler),

            forceNeedSync: repo.forceNeedSync,
        };
    },
};
