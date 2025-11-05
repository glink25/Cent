import { BillIndexedDBStorage } from "@/database/storage";
import { Giteeray } from "@/giteeray";
import type { Bill } from "@/ledger/type";
import { t } from "@/locale";
import type { Book, SyncEndpointFactory } from "../type";
import { createLoginAPI } from "./login";

const config = {
    repoPrefix: "cent-journal",
    entryName: "ledger",
    orderKeys: ["time"],
};

const LoginAPI = createLoginAPI();

const manuallyLogin = async () => {
    const token = prompt(t("please-enter-your-gitee-token"));
    if (!token) {
        return;
    }
    LoginAPI.manuallySetToken(token);
    location.reload();
};

export const GiteeEndpoint: SyncEndpointFactory = {
    type: "gitee",
    name: "Gitee",
    login: LoginAPI.login,
    manuallyLogin,
    init: () => {
        LoginAPI.afterLogin();
        const repo = new Giteeray<Bill>({
            ...config,
            auth: LoginAPI.getToken,
            storage: (name) => new BillIndexedDBStorage(`book-${name}`),
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
            window.open(`https://gitee.com/${bookId}/team`, "_blank");
        };

        const deleteBook = (bookId: string) => {
            const ok = confirm(t("delete-book-tip"));
            if (!ok) {
                return Promise.reject();
            }
            window.open(
                `https://gitee.com/${bookId}/settings#remove`,
                "_blank",
            );
            return Promise.reject();
        };

        return {
            logout: repo.dangerousClearAll.bind(repo),

            getUserInfo: repo.getUserInfo.bind(repo),
            getCollaborators: repo.getCollaborators.bind(repo),
            getOnlineAsset: repo.getOnlineAsset.bind(repo),

            fetchAllBooks: async (...args) => {
                const res = await repo.fetchAllStore(...args);
                return res.map((v) => ({ id: v, name: toBookName(v) }));
            },
            createBook: repo.createStore.bind(repo),
            initBook: repo.initStore.bind(repo),
            deleteBook,
            inviteForBook,

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
