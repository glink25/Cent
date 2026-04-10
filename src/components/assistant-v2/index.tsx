import {
    type RefObject,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { useIsDesktop } from "@/hooks/use-media-query";
import createConfirmProvider from "../confirm";
import { HintTooltip } from "../hint";
import AssistantForm from "./form";
import MainAssistant from "./main";

const [AssistantFormProvider, , showAssistant] = createConfirmProvider(
    AssistantForm,
    {
        dialogTitle: "AI Assistant",
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
);

const buttonGradient =
    "bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.5)] ";

export default function AssistantButton({
    sidePanelRef,
}: {
    sidePanelRef: RefObject<HTMLElement | null>;
}) {
    const isDesktop = useIsDesktop();
    const [isMobileAssistantShows, setIsMobileAssistantShows] = useState(false);
    const [isDesktopAssistantShows, setIsDesktopAssistantShows] =
        useState(false);
    const dismissMobileAssistantRef = useRef<() => void>(undefined);

    const toShowMobileAssistant = useCallback(() => {
        setIsMobileAssistantShows(true);
        const { promise, cancel } = showAssistant();
        dismissMobileAssistantRef.current = cancel;
        promise.finally(() => {
            setIsMobileAssistantShows(false);
        });
    }, []);

    const toShowAssistant = () => {
        if (isDesktop) {
            setIsDesktopAssistantShows((v) => !v);
        } else {
            toShowMobileAssistant();
        }
    };

    const isAssistantShows = isDesktopAssistantShows || isMobileAssistantShows;

    useEffect(() => {
        if (isDesktop) {
            dismissMobileAssistantRef.current?.();

            if (isAssistantShows) {
                setIsDesktopAssistantShows(true);
            }
        } else {
            setIsDesktopAssistantShows(false);
            if (isAssistantShows) {
                toShowMobileAssistant();
            }
        }
    }, [isDesktop, isAssistantShows, toShowMobileAssistant]);
    return (
        <MainAssistant.Root>
            <HintTooltip
                persistKey="assistantHintShows"
                content={"AI助手移到这了"}
            >
                <button
                    type="button"
                    className="w-10 h-8 flex items-center justify-center rounded-full transition-transform hover:scale-110 active:scale-95 cursor-pointer hover:bg-accent"
                    onClick={() => {
                        toShowAssistant();
                    }}
                >
                    <i className="icon-[mdi--shimmer-outline] text-lg bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600"></i>
                </button>
            </HintTooltip>
            <AssistantFormProvider />
            {isDesktopAssistantShows &&
                sidePanelRef.current &&
                createPortal(<MainAssistant.Content />, sidePanelRef.current)}
        </MainAssistant.Root>
    );
}
