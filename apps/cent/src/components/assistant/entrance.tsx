import { MainAssistant, type RuntimeConfig } from "@glink25/chaty/ui";
// cent 自身已是 Tailwind v4：chaty 组件的工具类由 cent 的 Tailwind 统一扫描 dist
// 生成（见 tailwind.config.mjs 的 content），避免引入第二份编译产物导致 layer 冲突。
// 这里只需补充 chaty 的 markdown 渲染样式（纯 CSS，无工具类冲突）。
import "@glink25/chaty/prose.css";
import {
    type RefObject,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { useShallow } from "zustand/shallow";
import { StorageAPI } from "@/api/storage";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useTheme } from "@/hooks/use-theme";
import { useIntl, useLocale } from "@/locale";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import createConfirmProvider from "../confirm";
import { HintTooltip } from "../hint";
import AssistantForm from "./form";
import { CentAIConfig } from "./tools";

const [AssistantFormProvider, , showAssistant] = createConfirmProvider(
    AssistantForm,
    {
        dialogTitle: "AI Assistant",
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(520px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[500px]",
    },
);

export default function AssistantButton({
    sidePanelRef,
}: {
    sidePanelRef: RefObject<HTMLElement | null>;
}) {
    const isDesktop = useIsDesktop();
    const t = useIntl();
    const { locale } = useLocale();
    const { theme } = useTheme();
    const [isMobileAssistantShows, setIsMobileAssistantShows] = useState(false);
    const [isDesktopAssistantShows, setIsDesktopAssistantShows] =
        useState(false);
    const dismissMobileAssistantRef = useRef<() => void>(undefined);

    const userId = useUserStore((s) => s.id);
    const currentBookId = useBookStore((s) => s.currentBookId);
    const { configs = [], defaultConfigId } = useLedgerStore(
        useShallow((state) => {
            const assistantData =
                state.infos?.meta.personal?.[userId]?.assistant;
            return {
                configs: assistantData?.configs,
                defaultConfigId: assistantData?.defaultConfigId,
            };
        }),
    );

    // 模型选择持久化到 ledger（受控配置：chaty UI 通过 onConfigChange 回传）。
    const onConfigChange = useCallback((configId: string) => {
        void useLedgerStore.getState().updatePersonalMeta((prev) => {
            if (!prev.assistant) {
                prev.assistant = {};
            }
            prev.assistant.defaultConfigId = configId;
            return prev;
        });
    }, []);

    const presetPrompts = useMemo(
        () => [
            {
                id: "analyze_ledger",
                label: t("preset_question.analyze_ledger.label"),
                prompt: t("preset_question.analyze_ledger.prompt"),
            },
            {
                id: "monthly_budget",
                label: t("preset_question.monthly_budget.label"),
                prompt: t("preset_question.monthly_budget.prompt"),
            },
            {
                id: "import_bills",
                label: t("preset_question.import_bills.label"),
                prompt: t("preset_question.import_bills.prompt"),
            },
            {
                id: "annual_summary",
                label: t("preset_question.annual_summary.label"),
                prompt: t("preset_question.annual_summary.prompt"),
            },
        ],
        [t],
    );

    const runtime = useMemo<RuntimeConfig>(
        () => ({
            ...CentAIConfig,
            scope: currentBookId
                ? `${StorageAPI.type}:${currentBookId}`
                : undefined,
            configs,
            defaultConfigId,
            presetPrompts,
            locale,
            theme,
            title: t("ai-assistant"),
            emptyStateSlogan: t("start-talk-to-ai"),
        }),
        [
            currentBookId,
            configs,
            defaultConfigId,
            presetPrompts,
            locale,
            theme,
            t,
        ],
    );

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
        <MainAssistant.Root
            runtime={runtime}
            selectedConfigId={defaultConfigId ?? configs[0]?.id}
            onConfigChange={onConfigChange}
        >
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
