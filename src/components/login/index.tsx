import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { LoginAPI, manuallySetToken } from "@/api/login";
import { t, useIntl } from "@/locale";
import { useUserStore } from "@/store/user";

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
                <div className="bg-[white] w-[350px] h-[450px] flex flex-col gap-4 justify-center items-center rounded">
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
        </div>,
        document.body,
    );
}
