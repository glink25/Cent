import { createGithubFetcher, type tokenGetter } from "./base";
import { getToken } from "./login";

export type UserInfo = {
	avatar_url: string;
	name: string;
	login: string;
	id: number;
};

const create = (tokenGetter: tokenGetter) => {
	const fetcher = createGithubFetcher(tokenGetter);
	const getUserInfo = async (login?: string | number) => {
		const res = await fetcher(`/user${login ? `/${login}` : ""}`);
		const json = await res.json();
		if (!res.ok || res.status === 401) {
			throw json;
		}
		return json as UserInfo;
	};

	return { getUserInfo };
};

export const UserAPI = create(getToken);
