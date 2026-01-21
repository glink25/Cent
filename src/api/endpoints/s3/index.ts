import type { S3Edit } from "@/components/modal/s3";
import { Scheduler } from "@/database/scheduler";
import { BillIndexedDBStorage } from "@/database/storage";
import type { Bill } from "@/ledger/type";
import { createTidal } from "@/tidal";
import { checkS3Config, createS3Syncer } from "@/tidal/s3";
import type { SyncEndpointFactory } from "../type";

const config = {
    repoPrefix: "cent-journal",
    entryName: "ledger",
    orderKeys: ["time"],
};
const key = "s3-config";

const getAuth = () => {
    const data = localStorage.getItem(key);
    if (!data) {
        return;
    }
    const parsed = JSON.parse(data);
    return parsed as S3Edit;
};

type S3PrivateMeta = {
    _s3UserAliases?: string[];
};

export const S3Endpoint: SyncEndpointFactory = {
    type: "s3",
    name: "s3",
    login: async ({ modal }) => {
        const auth = await modal.s3Auth({
            check: async (data) => {
                await checkS3Config({
                    endpoint: data.endpoint,
                    region: data.region,
                    accessKeyId: data.accessKeyId,
                    secretAccessKey: data.secretAccessKey,
                    bucket: data.bucket,
                    forcePathStyle: data.forcePathStyle,
                    sessionToken: data.sessionToken,
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

        localStorage.setItem("SYNC_ENDPOINT", "s3");
        localStorage.setItem(key, JSON.stringify(auth));
        location.reload();
    },
    manuallyLogin: undefined,
    init: () => {
        const auth = getAuth();
        if (!auth) {
            throw new Error("S3 auth not found");
        }

        const repo = createTidal<Bill>({
            storageFactory: (name) => new BillIndexedDBStorage(`book-${name}`),
            entryName: config.entryName,
            syncerFactory: () =>
                createS3Syncer({
                    ...config,
                    endpoint: auth.endpoint,
                    region: auth.region,
                    accessKeyId: auth.accessKeyId,
                    secretAccessKey: auth.secretAccessKey,
                    bucket: auth.bucket,
                    baseDir: auth.baseDir || "cent",
                    forcePathStyle: auth.forcePathStyle || false,
                    sessionToken: auth.sessionToken,
                }),
        });

        const toBookName = (bookId: string) => {
            return bookId.replace(`${config.repoPrefix}-`, "");
        };

        const getUserAliases = async (storeName: string) => {
            const meta: S3PrivateMeta | undefined =
                await repo.getMeta(storeName);
            if (!meta?._s3UserAliases) {
                return [];
            }
            return meta._s3UserAliases;
        };

        const scheduler = new Scheduler(async (signal) => {
            const [finished, cancel] = repo.sync();
            signal.onabort = cancel;
            await finished;
        });

        return {
            logout: async () => {
                await repo.detach();
            },
            getUserInfo: async () => {
                const Me = {
                    id: auth.customUserName || auth.accessKeyId,
                    name: auth.customUserName || auth.accessKeyId,
                    avatar_url: "/icon.png",
                };
                return Me;
            },
            getCollaborators: async (id) => {
                const aliases = await getUserAliases(id);
                const Me = {
                    id: auth.accessKeyId,
                    name: auth.accessKeyId,
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
                await repo.init(name);
                repo.getMeta(name).then((meta?: S3PrivateMeta) => {
                    const customUserName = auth.customUserName;
                    if (!customUserName) {
                        return;
                    }
                    if (!meta?._s3UserAliases?.includes(customUserName)) {
                        const newMeta = meta ?? {};
                        newMeta._s3UserAliases = [
                            ...(meta?._s3UserAliases ?? []),
                            customUserName,
                        ];
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
                confirm("请在您的 S3 存储桶中手动删除该文件夹");
            },
            inviteForBook: undefined,

            batch: async (...args) => {
                await repo.batch(...args);
                scheduler.schedule();
            },
            getMeta: repo.getMeta,
            getAllItems: repo.getAllItems,
            onChange: repo.onChange,

            getIsNeedSync: repo.hasStashes,
            onSync: scheduler.onProcess.bind(scheduler),
            toSync: scheduler.schedule.bind(scheduler),

            forceNeedSync: repo.forceNeedSync,
        };
    },
};
