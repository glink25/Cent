import { asyncOnce } from "@/utils/async";

// 从环境变量读取 LOGIN_API_HOST
const LOGIN_API_HOST = import.meta.env.VITE_LOGIN_API_HOST;
const LOCAL_TOKEN_KEY = "gitee_user_token";

const { promise: loginFinished, resolve: resolveLoginFinished } =
    Promise.withResolvers<void>();

export const createLoginAPI = () => {
    const login = () => {
        window.open(
            `${LOGIN_API_HOST}/api/gitee-oauth/authorize?redirect_uri=${encodeURIComponent(`${window.origin}`)}`,
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
        if (res.type !== "gitee") {
            return;
        }
        localStorage.removeItem("_oauth_res");
        const url = new URL(res.url);
        const tokenData = JSON.parse(
            url.searchParams.get("gitee_authorized") ?? "{}",
        );
        const accessToken = tokenData["access_token"];
        const expiresIn = tokenData["expires_in"];
        const refreshToken = tokenData["refresh_token"];
        const refreshTokenExpiresIn = tokenData["refresh_token_expires_in"];
        const tokenType = tokenData["token_type"];
        const scope = tokenData["scope"];

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
                    `${LOGIN_API_HOST}/api/gitee-oauth/refresh-token`,
                    {
                        method: "POST",
                        body: JSON.stringify({
                            refreshToken: token.refreshToken,
                        }),
                    },
                );
                const tokenData = (await res.json()) as GithubTokenResponse;
                const accessToken = tokenData["access_token"];
                const expiresIn = tokenData["expires_in"];
                const refreshToken = tokenData["refresh_token"];
                const refreshTokenExpiresIn =
                    tokenData["refresh_token_expires_in"];
                const tokenType = tokenData["token_type"];
                const scope = tokenData["scope"];
                const newToken = {
                    accessToken,
                    expiresIn: Date.now() + expiresIn * 1000,
                    refreshToken,
                    refreshTokenExpiresIn:
                        Date.now() +
                        (refreshTokenExpiresIn ?? 60 * 24 * 60 * 60) * 1000,
                    tokenType,
                    scope,
                };
                if (accessToken) {
                    localStorage.setItem(
                        LOCAL_TOKEN_KEY,
                        JSON.stringify(newToken),
                    );
                    return newToken;
                }
            }
        }
        return token;
    };

    const getToken = asyncOnce(_getToken);

    const manuallySetToken = (token: string) => {
        localStorage.setItem("SYNC_ENDPOINT", "gitee");
        localStorage.setItem(
            LOCAL_TOKEN_KEY,
            JSON.stringify({
                accessToken: token,
            }),
        );
    };

    const getLocalToken = () => {
        const item = localStorage.getItem(LOCAL_TOKEN_KEY);
        if (!item) {
            return undefined;
        }
        return JSON.parse(item) as Token;
    };

    return {
        login,
        getToken,
        manuallySetToken,
        getLocalToken,
        afterLogin,
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
