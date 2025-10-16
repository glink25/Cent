import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { LoginAPI, manuallySetToken } from "@/api/login";
import { t, useIntl } from "@/locale";
import { useUserStore } from "@/store/user";
import { cn } from "@/utils";

export default function Login() {
    const t = useIntl();
    const [isLogin, loading] = useUserStore(
        useShallow((state) => {
            return [Boolean(state.login) && state.id, state.loading];
        }),
    );
    if (isLogin) {
        return null;
    }

    const inputTokenToLogin = async () => {
        const token = prompt(t("please-enter-your-github-token"));
        if (!token) {
            return;
        }
        manuallySetToken(token);
        location.reload();
    };
    return createPortal(
        <div className="fixed top-0 right-0 z-[9999] w-screen h-screen overflow-hidden">
            <div className="absolute w-full h-full bg-[rgba(0,0,0,0.5)] z-[-1]"></div>
            <div className="w-full h-full flex justify-center items-center">
                <div className="bg-background w-[350px] h-[450px] flex flex-col gap-4 justify-center items-center rounded-lg overflow-hidden">
                    <Guide />
                    <div className="h-20 flex flex-col gap-4">
                        {loading ? (
                            <div>
                                <i className="icon-[mdi--loading] animate-spin"></i>
                                {t("login")}
                            </div>
                        ) : (
                            <>
                                <button
                                    type="button"
                                    className="rounded bg-black text-white px-2 py-1"
                                    onClick={() => {
                                        LoginAPI.login();
                                    }}
                                >
                                    {t("login-to-github")}
                                </button>
                                <button
                                    type="button"
                                    className="underline text-xs"
                                    onClick={inputTokenToLogin}
                                >
                                    {t("or-use-an-exist-token")}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>,
        document.body,
    );
}

function Guide({ className }: { className?: string }) {
    const t = useIntl();
    return (
        <div
            className={cn(
                "w-full flex-1 border-b bg-stone-800 text-white flex flex-col items-center justify-center gap-4 relative",
                className,
            )}
        >
            <h1 className="text-3xl font-bold">{t("APP_NAME")}</h1>
            <p className="text-sm">{t("app-introduce")}</p>
            <a
                className="absolute bottom-4 right-4 text-xs opacity-60 underline"
                target="_blank"
                href="https://glink25.github.io/post/Cent---%E4%BD%A0%E5%8F%AF%E8%83%BD%E5%8F%AA%E9%9C%80%E8%A6%81%E4%B8%80%E4%B8%AA%E8%AE%B0%E8%B4%A6%E8%BD%AF%E4%BB%B6/"
                rel="noopener"
            >
                查看介绍
            </a>
        </div>
    );
}
