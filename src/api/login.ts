const LOGIN_API_HOST = "http://localhost:8787";
// const LOGIN_API_HOST = "https://oncent-backend.linkai.work";

const LOCAL_TOKEN_KEY = "github_user_token";

const { promise: loginFinished, resolve: resolveLoginFinished } =
	Promise.withResolvers<void>();

const create = () => {
	const login = () => {
		window.open(
			`${LOGIN_API_HOST}/api/oauth/authorize?redirect_uri=${encodeURIComponent(`${window.origin}/after-login.html`)}`,
			"_self",
		);
	};

	const afterLogin = async () => {
		const res = localStorage.getItem("_oauth_res");
		if (!res) {
			resolveLoginFinished();
			return;
		}
		localStorage.removeItem("_oauth_res");
		const url = new URL(res);
		const accessSession = url.searchParams.get("accessSession");
		const [accessToken] = await Promise.all(
			[accessSession].map(async (s) => {
				const res = await fetch(`${LOGIN_API_HOST}/api/oauth/token`, {
					method: "POST",
					body: JSON.stringify({ session: s }),
				});
				const data = await res.json();
				return data.token;
			}),
		);
		if (accessToken)
			localStorage.setItem(
				LOCAL_TOKEN_KEY,
				JSON.stringify({
					accessToken,
				}),
			);
		resolveLoginFinished();
	};
	afterLogin();

	return {
		login,
	};
};

export type Token = { accessToken: string; refreshToken?: string };

export const getToken = async () => {
	await loginFinished;
	const item = localStorage.getItem(LOCAL_TOKEN_KEY);
	if (!item) {
		throw new Error("token not found");
	}
	return JSON.parse(item) as Token;
};

export const LoginAPI = create();
