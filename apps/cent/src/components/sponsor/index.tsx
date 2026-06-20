import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { usePreference } from "@/store/preference";
import createConfirmProvider from "../confirm";
import { AlipaySponsor } from "./alipay";
import { SponsorRoot } from "./root";
import { SolanaSponsor } from "./solana";

export { AlipaySponsor } from "./alipay";
export type { SponsorTabMeta } from "./root";
export { SponsorRoot, SponsorTab, SponsorTabContent } from "./root";
export { SolanaSponsor } from "./solana";

function Form({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();

    return (
        <PopupLayout
            title={t("sponsor-title")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col overflow-y-auto py-4 gap-4">
                <div className="px-4 flex flex-col gap-2">
                    <div className="text-base font-semibold flex items-center gap-2">
                        <i className="icon-[mdi--coffee-outline] size-5 text-yellow-400"></i>
                        {t("sponsor-intro-title")}
                    </div>
                    <div className="text-sm opacity-70 leading-relaxed">
                        {t("sponsor-intro-description")}
                    </div>
                </div>
                <SponsorRoot defaultValue="alipay">
                    <AlipaySponsor />
                    <SolanaSponsor />
                </SponsorRoot>
            </div>
        </PopupLayout>
    );
}

const [SponsorProvider, showSponsor] = createConfirmProvider(Form, {
    dialogTitle: "sponsor-title",
    dialogModalClose: true,
    contentClassName:
        "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(520px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[500px]",
});

export { SponsorProvider, showSponsor };

export default function SponsorBanner() {
    const t = useIntl();
    const [closed, setClosed] = usePreference("sponsorBannerClosed");

    if (closed) {
        return null;
    }
    return (
        <div className="px-4 pb-2">
            {/** biome-ignore lint/a11y/noStaticElementInteractions: banner uses div to avoid nested button */}
            {/** biome-ignore lint/a11y/useKeyWithClickEvents: banner uses div to avoid nested button */}
            <div
                onClick={() => {
                    showSponsor();
                }}
                className="relative w-full flex items-center gap-2 rounded-lg border bg-accent/30 hover:bg-accent/50 transition-colors px-3 py-2 cursor-pointer"
            >
                <i className="icon-[mdi--coffee-outline] size-5 shrink-0 text-yellow-400"></i>
                <div className="flex-1 text-sm pr-5">{t("sponsor-title")}</div>
                <button
                    type="button"
                    aria-label="close"
                    className="absolute top-1 right-1 flex w-4 h-4 cursor-pointer"
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setClosed(true);
                    }}
                >
                    <i className="icon-[mdi--close-circle] size-4 opacity-60"></i>
                </button>
            </div>
        </div>
    );
}

export function SponsorAboutItem() {
    const t = useIntl();
    return (
        <button
            type="button"
            onClick={() => {
                showSponsor();
            }}
            className="w-full min-h-10 pb-2 flex justify-between items-center px-4 cursor-pointer text-left"
        >
            <div className="flex items-center gap-2">
                <i className="icon-[mdi--coffee-outline] size-5 text-yellow-400"></i>
                <div className="text-sm">{t("sponsor-title")}</div>
            </div>
            <i className="icon-[mdi--chevron-right]"></i>
        </button>
    );
}
