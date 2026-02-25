import type { Modal } from "@/components/modal";
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

const manuallyLogin = async ({ modal }: { modal: Modal }) => {
    const token = await modal.prompt({
        title: t("please-enter-your-github-token"),
        input: { type: "text" },
    });
    if (!token) {
        return;
    }
    LoginAPI.manuallySetToken(token as string);
    location.reload();
};

export const GithubEndpoint: SyncEndpointFactory = {
    type: "github",
    name: "Github",
    login: LoginAPI.login,
    manuallyLogin,
    init: ({ modal }) => {
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

        const inviteForBook = async (bookId: string) => {
            await modal.prompt({ title: t("invite-tip") });
            window.open(
                `https://github.com/${bookId}/settings/access`,
                "_blank",
            );
        };

        const deleteBook = async (bookId: string) => {
            await modal.prompt({ title: t("delete-book-tip") });
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
            onSync: scheduler.onProcess.bind(scheduler),
            toSync: scheduler.schedule.bind(scheduler),

            forceNeedSync: repo.forceNeedSync,
        };
    },
};
