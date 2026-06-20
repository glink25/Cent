import { useIntl } from "@/locale";
import { SponsorTab, SponsorTabContent } from "./root";

// 注意：README 中两个二维码的 URL 文件名与实际内容相反，但 URL 是对的，严格遵循 README 里的链接。
const ALIPAY_QR = "https://glink25.github.io/post-assets/sponsor-solana.jpg";

export function AlipaySponsor() {
    const t = useIntl();
    return (
        <>
            <SponsorTab name="alipay">{t("sponsor-tab-alipay")}</SponsorTab>
            <SponsorTabContent
                name="alipay"
                className="flex flex-col items-center gap-2"
            >
                <img
                    src={ALIPAY_QR}
                    alt={t("sponsor-tab-alipay")}
                    className="w-48 min-h-48 max-w-full rounded-md border data-[state=loading]:animate-pulse bg-primary/10"
                />
            </SponsorTabContent>
        </>
    );
}
