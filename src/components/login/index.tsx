import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import { t, useIntl } from "@/locale";
import { useIsLogin, useUserStore } from "@/store/user";
import { cn } from "@/utils";
import { Button } from "../ui/button";

export default function Login() {
    const t = useIntl();
    const isLogin = useIsLogin();
    const [loading] = useUserStore(
        useShallow((state) => {
            return [state.loading];
        }),
    );
    if (isLogin) {
        return null;
    }
    return createPortal(
        <div className="fixed top-0 right-0 z-[998] w-screen h-screen overflow-hidden">
            <div className="absolute w-full h-full bg-[rgba(0,0,0,0.5)] z-[-1]"></div>
            <div className="w-full h-full flex justify-center items-center">
                <div className="bg-background w-[350px] h-[450px] flex flex-col gap-4 justify-center items-center rounded-lg overflow-hidden">
                    <Guide />
                    <div className="min-h-20 h-fit pb-4 flex flex-col gap-4">
                        {loading ? (
                            <div>
                                <i className="icon-[mdi--loading] animate-spin"></i>
                                {t("login")}
                            </div>
                        ) : (
                            <>
                                <div className="flex flex-col gap-1">
                                    <Button
                                        onClick={() => {
                                            StorageAPI.loginWith("github");
                                        }}
                                    >
                                        <i className="icon-[mdi--github]"></i>
                                        <div className="flex-1">
                                            {t("login-to-github")}
                                        </div>
                                    </Button>
                                    <button
                                        type="button"
                                        className="underline text-xs cursor-pointer"
                                        onClick={() =>
                                            StorageAPI.loginManuallyWith(
                                                "github",
                                            )
                                        }
                                    >
                                        {t("or-use-an-exist-token")}
                                    </button>
                                </div>
                                <div>
                                    <Button
                                        variant="secondary"
                                        className="w-full"
                                        onClick={() => {
                                            StorageAPI.loginWith("offline");
                                        }}
                                    >
                                        <i className="icon-[mdi--local]"></i>
                                        <div className="flex-1">
                                            {t("offline-mode")}
                                        </div>
                                    </Button>
                                </div>
                                <div>
                                    <Button
                                        variant="secondary"
                                        className="w-full relative after:content-['beta'] after:rounded after:bg-yellow-400 after:px-[2px] after:text-[8px] after:block after:absolute after:top-0 after:right-0 after:translate-x-[calc(50%)]"
                                        onClick={() => {
                                            StorageAPI.loginWith("webdav");
                                        }}
                                    >
                                        <i className="icon-[mdi--floppy-disk]"></i>
                                        <div className="flex-1">Web DAV</div>
                                    </Button>
                                </div>
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
            <div className="text-xs opacity-60">{t("pwa-install-tip")}</div>
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
