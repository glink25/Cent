/** biome-ignore-all lint/a11y/noSvgWithoutTitle: <explanation> */
import { KeyRound } from "lucide-react";
import { type ReactNode, useEffect } from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import {
    AppDownloadIcons,
    useLoginAppDownloadPlatforms,
} from "@/components/app-download";
import { useIntl } from "@/locale";
import { isMeasurementEnabled, measure } from "@/measurement";
import { useIsLogin, useUserStore } from "@/store/user";

const loaded = import("@/api/storage");

const loadStorageAPI = async () => {
    const lib = await loaded;
    return lib.StorageAPI;
};

const primaryButtonStyle = `inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 h-9 rounded-md shadow`;

const secondaryButtonStyle = `inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 bg-secondary text-secondary-foreground shadow-sm hover:bg-secondary/80 h-9 px-4 py-2 w-full`;

const betaClassName = `relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(50%)]`;

const LOGIN_METHODS = ["github", "gitee", "webdav", "s3", "offline"] as const;
type LoginMethod = (typeof LOGIN_METHODS)[number];
let loginMethodMeasured = false;

function isLoginMethod(value: string): value is LoginMethod {
    return (LOGIN_METHODS as readonly string[]).includes(value);
}

export default function Login() {
    const t = useIntl();
    const isLogin = useIsLogin();
    const [loading] = useUserStore(
        useShallow((state) => {
            return [state.loading];
        }),
    );
    useEffect(() => {
        if (!isLogin || loginMethodMeasured) return;
        loginMethodMeasured = true;
        void loadStorageAPI()
            .then((StorageAPI) => {
                const method = StorageAPI.type;
                if (isLoginMethod(method)) {
                    measure("login_method_used", { method });
                }
            })
            .catch(() => {});
    }, [isLogin]);
    if (isLogin) {
        return null;
    }
    return createPortal(
        <div className="fixed inset-0 z-[1] overflow-hidden">
            <div className="absolute w-full h-full bg-[rgba(0,0,0,0.5)] z-[-1]"></div>
            <div className="flex h-full w-full items-center justify-center p-5">
                <div className="max-h-full w-full max-w-[350px] overflow-y-auto rounded-lg bg-background md:max-w-[840px]">
                    <div className="grid min-h-[560px] grid-rows-[1fr_auto] md:min-h-[460px] md:grid-cols-[1.15fr_1fr] md:grid-rows-1">
                        <Guide />
                        <div className="flex min-w-0 flex-col items-center justify-center gap-4 px-6 py-6">
                            <div className="flex min-h-20 w-full max-w-60 flex-col justify-center gap-4">
                                {loading ? (
                                    <div className="text-center">
                                        <i className="icon-[mdi--loading] animate-spin"></i>
                                        {t("login")}
                                    </div>
                                ) : (
                                    <>
                                        <ProviderLoginButtons
                                            provider="github"
                                            name="GitHub"
                                        >
                                            <i
                                                className="icon-[mdi--github]"
                                                aria-hidden="true"
                                            />
                                        </ProviderLoginButtons>
                                        <ProviderLoginButtons
                                            provider="gitee"
                                            name="Gitee"
                                        >
                                            <svg
                                                fill="currentColor"
                                                width="32"
                                                height="32"
                                                viewBox="0 0 24 24"
                                                aria-hidden="true"
                                                xmlns="http://www.w3.org/2000/svg"
                                            >
                                                <path d="M11.984 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.016 0zm6.09 5.333c.328 0 .593.266.592.593v1.482a.594.594 0 0 1-.593.592H9.777c-.982 0-1.778.796-1.778 1.778v5.63c0 .327.266.592.593.592h5.63c.982 0 1.778-.796 1.778-1.778v-.296a.593.593 0 0 0-.592-.593h-4.15a.592.592 0 0 1-.592-.592v-1.482a.593.593 0 0 1 .593-.592h6.815c.327 0 .593.265.593.592v3.408a4 4 0 0 1-4 4H5.926a.593.593 0 0 1-.593-.593V9.778a4.444 4.444 0 0 1 4.445-4.444h8.296z" />
                                            </svg>
                                        </ProviderLoginButtons>
                                        {/* Web DAV */}
                                        <div>
                                            <button
                                                type="button"
                                                className={`${secondaryButtonStyle} ${betaClassName}`}
                                                onClick={async () => {
                                                    const StorageAPI =
                                                        await loadStorageAPI();
                                                    StorageAPI.loginWith(
                                                        "webdav",
                                                    );
                                                }}
                                            >
                                                <i className="icon-[mdi--floppy-disk]"></i>
                                                <div className="flex-1">
                                                    Web DAV
                                                </div>
                                            </button>
                                        </div>
                                        {/* S3 */}
                                        <div>
                                            <button
                                                type="button"
                                                className={`${secondaryButtonStyle} ${betaClassName}`}
                                                onClick={async () => {
                                                    const StorageAPI =
                                                        await loadStorageAPI();
                                                    StorageAPI.loginWith("s3");
                                                }}
                                            >
                                                <i className="icon-[mdi--database]"></i>
                                                <div className="flex-1">S3</div>
                                            </button>
                                        </div>
                                        {/* Offline */}
                                        <div>
                                            <button
                                                type="button"
                                                className={`${secondaryButtonStyle} !w-full`}
                                                onClick={async () => {
                                                    const StorageAPI =
                                                        await loadStorageAPI();
                                                    StorageAPI.loginWith(
                                                        "offline",
                                                    );
                                                }}
                                            >
                                                <i className="icon-[mdi--local]"></i>
                                                <div className="flex-1">
                                                    {t("offline-mode")}
                                                </div>
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                            {isMeasurementEnabled() && (
                                <p className="max-w-72 text-center text-[10px] leading-relaxed text-foreground/50">
                                    {t("login-agreement-prefix")}{" "}
                                    <a
                                        className="underline hover:text-foreground/80"
                                        href="https://linkai.work/cent/terms"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {t("terms-of-use")}
                                    </a>{" "}
                                    {t("login-agreement-conjunction")}{" "}
                                    <a
                                        className="underline hover:text-foreground/80"
                                        href="https://linkai.work/cent/privacy"
                                        target="_blank"
                                        rel="noopener noreferrer"
                                    >
                                        {t("privacy-policy")}
                                    </a>
                                    {t("login-agreement-suffix")}
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function ProviderLoginButtons({
    provider,
    name,
    children,
}: {
    provider: "github" | "gitee";
    name: string;
    children: ReactNode;
}) {
    const t = useIntl();
    const tokenLabel = t("login-with-token", { provider: name });
    const color =
        provider === "gitee"
            ? "bg-[#b7312d] text-white hover:bg-[#a52c28]"
            : "bg-primary text-primary-foreground hover:bg-primary/90";

    return (
        <div className="flex gap-2">
            <button
                type="button"
                className={`${primaryButtonStyle} ${color} flex-1 px-4`}
                onClick={async () => {
                    const StorageAPI = await loadStorageAPI();
                    StorageAPI.loginWith(provider);
                }}
            >
                {children}
                <span className="flex-1">{t(`login-to-${provider}`)}</span>
            </button>
            <button
                type="button"
                className={`${primaryButtonStyle} ${color} w-9 shrink-0`}
                aria-label={tokenLabel}
                title={tokenLabel}
                onClick={async () => {
                    const StorageAPI = await loadStorageAPI();
                    StorageAPI.loginManuallyWith(provider);
                }}
            >
                <KeyRound aria-hidden="true" />
            </button>
        </div>
    );
}

function Guide() {
    const t = useIntl();
    const platforms = useLoginAppDownloadPlatforms();

    return (
        <div
            className={
                "relative flex min-h-52 min-w-0 flex-col items-center justify-center gap-3 bg-stone-800 px-4 pt-4 pb-14 text-center text-white md:pb-16"
            }
        >
            <h1 className="text-3xl font-bold">{t("APP_NAME")}</h1>
            <p className="text-sm text-center">{t("app-introduce")}</p>
            <div className="text-xs opacity-60">{t("pwa-install-tip")}</div>
            <div className="absolute bottom-4 left-4 flex justify-center">
                <AppDownloadIcons variant="login" platforms={platforms} />
            </div>
            <a
                className="absolute bottom-4 right-4 text-xs opacity-60 underline"
                target="_blank"
                href="https://glink25.github.io/post/Cent---%E4%BD%A0%E5%8F%AF%E8%83%BD%E5%8F%AA%E9%9C%80%E8%A6%81%E4%B8%80%E4%B8%AA%E8%AE%B0%E8%B4%A6%E8%BD%AF%E4%BB%B6/"
                rel="noopener"
            >
                {t("see-introduce")}
            </a>
        </div>
    );
}
