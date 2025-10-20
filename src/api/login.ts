import { asyncOnce } from "@/utils/async";

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
                    expiresIn: Date.now() + expiresIn,
                    refreshToken,
                    refreshTokenExpiresIn: Date.now() + refreshTokenExpiresIn,
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

type GithubTokenResponse = {
    access_token: string;
    expires_in: number;
    refresh_token: string;
    refresh_token_expires_in: number;
    scope: string;
    token_type: string;
};

export type Token = {
    accessToken: string;
    refreshToken?: string;
    expiresIn?: number;
    refreshTokenExpiresIn?: number;
};

const _getToken = async () => {
    await loginFinished;
    const token = getLocalToken();
    if (!token) {
        throw new Error("token not found");
    }
    if (token.expiresIn) {
        const now = Date.now();
        const diff = token.expiresIn - now;
        // 小于2小时 刷新token
        if (diff < 2 * 60 * 60 * 1000) {
            // to refresh
            const res = await fetch(
                `${LOGIN_API_HOST}/api/github-oauth/refresh-token`,
                {
                    method: "POST",
                    body: JSON.stringify({ refreshToken: token.refreshToken }),
                },
            );
            const githubTokenData = (await res.json()) as GithubTokenResponse;
            const accessToken = githubTokenData["access_token"];
            const expiresIn = githubTokenData["expires_in"];
            const refreshToken = githubTokenData["refresh_token"];
            const refreshTokenExpiresIn =
                githubTokenData["refresh_token_expires_in"];
            const tokenType = githubTokenData["token_type"];
            const scope = githubTokenData["scope"];
            const newToken = {
                accessToken,
                expiresIn: Date.now() + expiresIn * 1000,
                refreshToken,
                refreshTokenExpiresIn:
                    Date.now() + refreshTokenExpiresIn * 1000,
                tokenType,
                scope,
            };
            if (accessToken) {
                localStorage.setItem(LOCAL_TOKEN_KEY, JSON.stringify(newToken));
                return newToken;
            }
        }
    }
    return token;
};

export const getToken = asyncOnce(_getToken);

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
