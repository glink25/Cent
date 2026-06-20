import { toast } from "sonner";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { SponsorTab, SponsorTabContent } from "./root";

// 注意：README 中两个二维码的 URL 文件名与实际内容相反，但 URL 是对的，严格遵循 README 里的链接。
const SOLANA_QR = "https://glink25.github.io/post-assets/sponsor-alipay.jpg";
const SOLANA_ADDRESS = "vEzM9jmxChx2AoMMDpHARHZcUjmUCHdBShwF9eJYGEg";

export function SolanaSponsor() {
    const t = useIntl();
    const copyAddress = async () => {
        try {
            await navigator.clipboard.writeText(SOLANA_ADDRESS);
            toast.success(t("copied"));
        } catch {
            toast.error(SOLANA_ADDRESS);
        }
    };
    return (
        <>
            <SponsorTab name="solana">{t("sponsor-tab-solana")}</SponsorTab>
            <SponsorTabContent
                name="solana"
                className="flex flex-col items-center gap-3"
            >
                <img
                    src={SOLANA_QR}
                    alt={t("sponsor-tab-solana")}
                    className="w-48 min-h-48 rounded-md border data-[state=loading]:animate-pulse bg-primary/10"
                />
                <div className="w-full flex flex-col gap-1">
                    <div className="text-xs opacity-60">
                        {t("sponsor-wallet-address")}
                    </div>
                    <div className="flex items-center gap-2 rounded-md border px-2 py-1">
                        <div className="flex-1 text-xs break-all font-mono">
                            {SOLANA_ADDRESS}
                        </div>
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={copyAddress}
                            className="shrink-0"
                        >
                            <i className="icon-[mdi--content-copy] size-4"></i>
                            <span className="ml-1 text-xs">
                                {t("copy-address")}
                            </span>
                        </Button>
                    </div>
                </div>
            </SponsorTabContent>
        </>
    );
}
