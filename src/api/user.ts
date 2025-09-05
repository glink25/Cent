import { createGithubFetcher, type tokenGetter } from "./base";
import { getToken } from "./login";

const create = (tokenGetter: tokenGetter) => {
	const fetcher = createGithubFetcher(tokenGetter);
	const getUserInfo = async () => {
		const res = await fetcher("/user");
		const json = await res.json();
		if (!res.ok) {
			throw json;
		}
		return json as {
			avatar_url: string;
			name: string;
			login: string;
			id: number;
		};
	};
	return { getUserInfo };
};

export const UserAPI = create(getToken);
