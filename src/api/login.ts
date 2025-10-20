// const LOGIN_API_HOST = "http://localhost:8787";
const LOGIN_API_HOST = "https://oncent-backend.linkai.work";

const LOCAL_TOKEN_KEY = "github_user_token";

const { promise: loginFinished, resolve: resolveLoginFinished } =
    Promise.withResolvers<void>();

const create = () => {
    const login = () => {
        window.open(
            `${LOGIN_API_HOST}/api/github-oauth/authorize?redirect_uri=${encodeURIComponent(`${window.origin}`)}`,
            "_self",
        );
    };

    const afterLogin = async () => {
        const resText = localStorage.getItem("_oauth_res");
        if (!resText) {
            resolveLoginFinished();
            return;
        }
        const res = JSON.parse(resText);
        if (res.type !== "github") {
            return;
        }
        localStorage.removeItem("_oauth_res");
        const url = new URL(res.url);
        const githubTokenData = JSON.parse(
            url.searchParams.get("github_authorized") ?? "{}",
        );
        const accessToken = githubTokenData["access_token"];
        const expiresIn = githubTokenData["expires_in"];
        const refreshToken = githubTokenData["refresh_token"];
        const refreshTokenExpiresIn =
            githubTokenData["refresh_token_expires_in"];
        const tokenType = githubTokenData["token_type"];
        const scope = githubTokenData["scope"];

        if (accessToken)
            localStorage.setItem(
                LOCAL_TOKEN_KEY,
                JSON.stringify({
                    accessToken,
                    expiresIn,
                    refreshToken,
                    refreshTokenExpiresIn,
                    tokenType,
                    scope,
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
    const token = getLocalToken();
    if (!token) {
        throw new Error("token not found");
    }
    return token;
};

export const manuallySetToken = (token: string) => {
    localStorage.setItem(
        LOCAL_TOKEN_KEY,
        JSON.stringify({
            accessToken: token,
        }),
    );
};

export const getLocalToken = () => {
    const item = localStorage.getItem(LOCAL_TOKEN_KEY);
    if (!item) {
        return undefined;
    }
    return JSON.parse(item) as Token;
};

export const LoginAPI = create();
