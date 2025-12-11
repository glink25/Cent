import { Scheduler } from "@/database/scheduler";
import { BillIndexedDBStorage } from "@/database/storage";
import type { Bill } from "@/ledger/type";
import { t } from "@/locale";
import { createTidal } from "@/tidal";
import { createGithubSyncer } from "@/tidal/github";
import type { SyncEndpointFactory } from "../type";
import { createLoginAPI } from "./login";

const config = {
    repoPrefix: "cent-journal",
    entryName: "ledger",
    orderKeys: ["time"],
};

const LoginAPI = createLoginAPI();

const manuallyLogin = async () => {
    const token = prompt(t("please-enter-your-github-token"));
    if (!token) {
        return;
    }
    LoginAPI.manuallySetToken(token);
    location.reload();
};

export const GithubEndpoint: SyncEndpointFactory = {
    type: "github",
    name: "Github",
    login: LoginAPI.login,
    manuallyLogin,
    init: () => {
        LoginAPI.afterLogin();
        const repo = createTidal<Bill>({
            storageFactory: (name) => new BillIndexedDBStorage(`book-${name}`),
            entryName: config.entryName,
            syncerFactory: () =>
                createGithubSyncer({
                    auth: LoginAPI.getToken,
                    entryName: config.entryName,
                    repoPrefix: config.repoPrefix,
                }),
        });

        const toBookName = (bookId: string) => {
            const [owner, repo] = bookId.split("/");
            return repo.replace(`${config.repoPrefix}-`, "");
        };

        const inviteForBook = (bookId: string) => {
            const ok = confirm(t("invite-tip"));
            if (!ok) {
                return;
            }
            window.open(
                `https://github.com/${bookId}/settings/access`,
                "_blank",
            );
        };

        const deleteBook = (bookId: string) => {
            const ok = confirm(t("delete-book-tip"));
            if (!ok) {
                return Promise.reject();
            }
            window.open(`https://github.com/${bookId}/settings`, "_blank");
            return Promise.reject();
        };

        const scheduler = new Scheduler(async (signal) => {
            const [finished, cancel] = repo.sync();
            signal.onabort = cancel;
            await finished;
        });

        return {
            logout: async () => {
                repo.detach();
            },
            getUserInfo: repo.getUserInfo,
            getCollaborators: repo.getCollaborators,
            getOnlineAsset: (src, store) => repo.getAsset(src, store),

            fetchAllBooks: async (...args) => {
                const res = await repo.fetchAllStore(...args);
                return res.map((v) => ({ id: v, name: toBookName(v) }));
            },
            createBook: repo.create,
            initBook: repo.init,
            deleteBook,
            inviteForBook,

            batch: async (...args) => {
                await repo.batch(...args);
                scheduler.schedule();
            },
            getMeta: repo.getMeta,
            getAllItems: repo.getAllItems,
            onChange: repo.onChange,

            getIsNeedSync: repo.hasStashes,
            onSync: scheduler.onProcess,
            toSync: scheduler.schedule,
        };
    },
};
