import { BillIndexeBDStorage } from "@/database/storage";
import { Gitray } from "@/gitray";
import type { Bill } from "@/ledger/type";
import { t } from "@/locale";
import type { Book, SyncEndpointFactory } from "../type";
import { createLoginAPI } from "./login";

export const createGithubEndpoint: SyncEndpointFactory = (config) => {
    const LoginAPI = createLoginAPI();
    const repo = new Gitray<Bill>({
        ...config,
        auth: LoginAPI.getToken,
        storage: (name) => new BillIndexeBDStorage(`book-${name}`),
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
        window.open(`https://github.com/${bookId}/settings/access`, "_blank");
    };

    const deleteBook = (bookId: string) => {
        const ok = confirm(t("delete-book-tip"));
        if (!ok) {
            return;
        }
        window.open(`https://github.com/${bookId}/settings`, "_blank");
    };
    const manuallyLogin = async () => {
        const token = prompt(t("please-enter-your-github-token"));
        if (!token) {
            return;
        }
        LoginAPI.manuallySetToken(token);
        location.reload();
    };

    return {
        type: "github",
        name: "Github",
        login: LoginAPI.login,
        logout: repo.dangerousClearAll.bind(repo),
        manuallyLogin,

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
};
