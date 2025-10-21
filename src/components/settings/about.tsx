import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    return (
        <PopupLayout
            title={t("about-cent")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="divide-y divide-solid flex flex-col overflow-hidden py-4 gap-2">
                <div className="w-full flex flex-col justify-between items-center px-4 gap-2 pb-4">
                    <img
                        src="/icon.png"
                        alt=""
                        width={80}
                        height={80}
                        className="rounded-lg shadow-md aspect-square"
                    />
                    <div className="flex flex-col justify-center items-center">
                        <div className="font-semibold">
                            {t("cent-app-name")}
                        </div>
                        <div className="text-xs opacity-60">
                            {t("version")}: {__BUILD_INFO.version}
                        </div>
                    </div>
                </div>
                <a
                    className="w-full h-10 flex justify-between items-center px-4"
                    target="_blank"
                    href="https://github.com/glink25/Cent/issues/new"
                    rel="noopener"
                >
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--alternate-email] size-5"></i>
                        <div className="text-sm">{t("feedback")}</div>
                    </div>
                    <i className="icon-[mdi--arrow-top-right]"></i>
                </a>
                <a
                    className="w-full h-10 flex justify-between items-center px-4"
                    target="_blank"
                    href="https://glink25.github.io/tag/Cent/"
                    rel="noopener"
                >
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--rss-box] size-5"></i>
                        <div className="text-sm">{t("blog")}</div>
                    </div>
                    <i className="icon-[mdi--arrow-top-right]"></i>
                </a>
                <a
                    className="w-full h-10 flex justify-between items-center px-4"
                    target="_blank"
                    href="https://github.com/glink25/Cent"
                    rel="noopener"
                >
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--github] size-5"></i>
                        <div className="text-sm">Github</div>
                    </div>
                    <i className="icon-[mdi--arrow-top-right]"></i>
                </a>
                {/* <div className="w-full h-10 flex justify-between items-center px-4 opacity-60">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--github] size-5"></i>
                        <div className="text-sm">Github</div>
                    </div>
                    <div className="text-xs">{t("preparing")}</div>
                </div> */}
            </div>
        </PopupLayout>
    );
}

const [AboutSettingsProvider, showAboutSettings] = createConfirmProvider(Form, {
    dialogTitle: "experimental-functions",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
});

export default function AboutSettingsItem() {
    const t = useIntl();
    return (
        <div className="lab">
            <Button
                onClick={() => {
                    showAboutSettings();
                }}
                variant="ghost"
                className="w-full py-4 rounded-none h-auto"
            >
                <div className="w-full px-4 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <i className="icon-[mdi--about-circle-outline] size-5"></i>
                        {t("about-cent")}
                    </div>
                    <i className="icon-[mdi--chevron-right] size-5"></i>
                </div>
            </Button>
            <AboutSettingsProvider />
        </div>
    );
}
