import { useMediaQuery } from "@/hooks/use-media-query";
import { useIntl } from "@/locale";
import { cn } from "@/utils";

export const IOS_APP_STORE_URL =
    "https://apps.apple.com/us/app/cent-%E9%87%8D%E6%96%B0%E5%AE%9A%E4%B9%89%E8%AE%B0%E8%B4%A6/id6764264950";

export const ANDROID_PLAY_STORE_URL =
    "https://play.google.com/store/apps/details?id=com.glink25.dailycent";

const defaultButtonClassName =
    "inline-flex size-8 items-center justify-center rounded-full bg-white/5 text-white/80 transition-colors hover:border-white/50 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60";

const aboutButtonClassName =
    "inline-flex size-10 items-center justify-center rounded-full bg-secondary text-secondary-foreground transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

function isIOSDevice() {
    if (typeof navigator === "undefined") {
        return false;
    }
    return (
        /iPad|iPhone|iPod/.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
    );
}

function isAndroidDevice() {
    if (typeof navigator === "undefined") {
        return false;
    }
    return /Android/i.test(navigator.userAgent);
}

export function useLoginAppDownloadPlatforms() {
    const isStandaloneDisplay = useMediaQuery("(display-mode: standalone)");
    const isIOSStandalone =
        typeof navigator !== "undefined" &&
        (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const inAppShell = isStandaloneDisplay || isIOSStandalone;

    if (inAppShell) {
        return [] as const;
    }

    const isIOS = isIOSDevice();
    const isAndroid = isAndroidDevice();

    if (isIOS) {
        return ["ios"] as const;
    }
    if (isAndroid) {
        return ["android"] as const;
    }

    return ["ios", "android"] as const;
}

type AppDownloadPlatform = "ios" | "android";

type AppDownloadIconsProps = {
    className?: string;
    buttonClassName?: string;
    iconClassName?: string;
    variant?: "login" | "about";
    platforms?: readonly AppDownloadPlatform[];
};

export function AppDownloadIcons({
    className,
    buttonClassName,
    iconClassName = "size-4",
    variant = "login",
    platforms = ["ios", "android"],
}: AppDownloadIconsProps) {
    const t = useIntl();
    const resolvedButtonClassName =
        buttonClassName ??
        (variant === "about" ? aboutButtonClassName : defaultButtonClassName);

    const showIOS = platforms.includes("ios");
    const showAndroid = platforms.includes("android");

    if (!showIOS && !showAndroid) {
        return null;
    }

    return (
        <div className={cn("flex items-center gap-2", className)}>
            {showIOS && (
                <a
                    className={resolvedButtonClassName}
                    target="_blank"
                    href={IOS_APP_STORE_URL}
                    rel="noopener noreferrer"
                    aria-label={t("download-ios-app")}
                >
                    <i
                        className={cn("icon-[mdi--apple]", iconClassName)}
                        aria-hidden="true"
                    ></i>
                    <span className="sr-only">{t("download-ios-app")}</span>
                </a>
            )}
            {showAndroid && (
                <a
                    className={resolvedButtonClassName}
                    target="_blank"
                    href={ANDROID_PLAY_STORE_URL}
                    rel="noopener noreferrer"
                    aria-label={t("download-android-app")}
                >
                    <i
                        className={cn("icon-[mdi--android]", iconClassName)}
                        aria-hidden="true"
                    ></i>
                    <span className="sr-only">{t("download-android-app")}</span>
                </a>
            )}
        </div>
    );
}
