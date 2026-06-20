import type { Modal } from "@/components/modal";
import { Scheduler } from "@/database/scheduler";
import { BillIndexedDBStorage } from "@/database/storage";
import type { Bill } from "@/ledger/type";
import { t } from "@/locale";
import { createTidal } from "@/tidal";
import { createGiteeSyncer } from "@/tidal/gitee";
import type { ZenPost } from "@/zen/types";
import type { SyncEndpointFactory } from "../type";
import { createLoginAPI } from "./login";

const ZEN_ENTRY_NAME = "zen";

const config = {
    repoPrefix: "cent-journal",
    entryName: "ledger",
    orderKeys: ["time"],
};

const LoginAPI = createLoginAPI();

const manuallyLogin = async ({ modal }: { modal: Modal }) => {
    const token = await modal.prompt({
        title: t("please-enter-your-gitee-token"),
        input: { type: "text" },
    });
    if (!token) {
        return;
    }
    LoginAPI.manuallySetToken(token as string);
    location.reload();
};

export const GiteeEndpoint: SyncEndpointFactory = {
    type: "gitee",
    name: "Gitee",
    login: LoginAPI.login,
    manuallyLogin,
    init: ({ modal }) => {
        LoginAPI.afterLogin();
        const repo = createTidal<Bill>({
            storageFactory: (name) => new BillIndexedDBStorage(`book-${name}`),
            entryName: config.entryName,
            syncerFactory: () =>
                createGiteeSyncer({
                    auth: LoginAPI.getToken,
                    entryName: config.entryName,
                    repoPrefix: config.repoPrefix,
                }),
        });
        const zenRepo = createTidal<ZenPost>({
            storageFactory: (name) =>
                new BillIndexedDBStorage(`book-${name}--${ZEN_ENTRY_NAME}`),
            entryName: ZEN_ENTRY_NAME,
            syncerFactory: () =>
                createGiteeSyncer({
                    auth: LoginAPI.getToken,
                    entryName: ZEN_ENTRY_NAME,
                    repoPrefix: config.repoPrefix,
                }),
        });

        const toBookName = (bookId: string) => {
            const [owner, repo] = bookId.split("/");
            return repo.replace(`${config.repoPrefix}-`, "");
        };

        const inviteForBook = async (bookId: string) => {
            await modal.prompt({ title: t("invite-tip") });
            window.open(`https://gitee.com/${bookId}/team`, "_blank");
        };

        const deleteBook = async (bookId: string) => {
            await modal.prompt({ title: t("delete-book-tip") });
            window.open(
                `https://gitee.com/${bookId}/settings#remove`,
                "_blank",
            );
            return Promise.reject();
        };

        // ledger 与 zen 顺序同步：避免对同一 git ref 并发提交导致 non-fast-forward
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
                repo.detach();
                zenRepo.detach();
            },
            getUserInfo: repo.getUserInfo,
            getCollaborators: repo.getCollaborators,
            getOnlineAsset: (src, store) => repo.getAsset(src, store),

            fetchAllBooks: async (...args) => {
                const res = await repo.fetchAllStore(...args);
                return res.map((v) => ({ id: v, name: toBookName(v) }));
            },
            createBook: repo.create,
            initBook: async (name) => {
                await Promise.all([repo.init(name), zenRepo.init(name)]);
            },
            deleteBook,
            inviteForBook,

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
