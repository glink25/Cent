import { createGithubFetcher, type tokenGetter } from "./base";
import { getToken } from "./login";

export type UserInfo = {
    avatar_url: string;
    name: string;
    login: string;
    id: string;
};

const create = (tokenGetter: tokenGetter) => {
    const fetcher = createGithubFetcher(tokenGetter);
    const getUserInfo = async (login?: string | number) => {
        const res = await fetcher(`/user${login ? `/${login}` : ""}`);
        const json = await res.json();
        if (!res.ok || res.status === 401) {
            throw json;
        }
        return { ...json, name: json.login } as UserInfo;
    };

    const getCollaborators = async (repoFullName: string) => {
        const [owner, repo] = repoFullName.split("/");
        const res = await fetcher(`/repos/${owner}/${repo}/collaborators`);
        const json = await res.json();
        if (!res.ok || res.status === 401) {
            throw json;
        }
        return json.map((v: UserInfo) => ({
            ...v,
            name: v.login,
        })) as UserInfo[];
    };

    return { getUserInfo, getCollaborators };
};

export const UserAPI = create(getToken);
