import type { Token } from "./login";

const GITHUB_API_HOST = "https://api.github.com";

export type tokenGetter = () => Promise<Token | undefined>;

export const createGithubFetcher = (tokenGetter: tokenGetter) => {
	let token: Token | undefined;
	const withToken = async () => {
		if (token === undefined) {
			token = await tokenGetter();
			if (token === undefined) {
				throw new Error("token not found");
			}
			return token;
		}
		return token;
	};

	const fetcher = async (route: string, init?: RequestInit) => {
		const { accessToken } = await withToken();
		return fetch(`${GITHUB_API_HOST}${route}`, {
			headers: {
				Authorization: `Bearer ${accessToken}`,
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
			},
			...init,
		});
	};

	return fetcher;
};
