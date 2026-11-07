import { MainAssistant, type RuntimeConfig } from "@glink25/chaty/ui";
// cent 自身已是 Tailwind v4：chaty 组件的工具类由 cent 的 Tailwind 统一扫描 dist
// 生成（见 tailwind.config.mjs 的 content），避免引入第二份编译产物导致 layer 冲突。
// 这里只需补充 chaty 的 markdown 渲染样式（纯 CSS，无工具类冲突）。
import "@glink25/chaty/prose.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/shallow";
import { undoChange } from "@/agent/changes";
import { StorageAPI, StorageDeferredAPI } from "@/api/storage";
import { useIsDesktop } from "@/hooks/use-media-query";
import { useTheme } from "@/hooks/use-theme";
import { useIntl, useLocale } from "@/locale";
import { measure } from "@/measurement";
import {
    createAssistantTokenUsageProvider,
    toTokenUsageApiType,
} from "@/measurement/token-usage";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import createConfirmProvider from "../confirm";
import AssistantForm from "./form";
import { assistantScope, useAssistantLauncher } from "./launcher";
import { getAIConfig } from "./request";
import { CentAIConfig } from "./tools";

const [AssistantFormProvider, , showAssistant] = createConfirmProvider(
    AssistantForm,
    {
        dialogTitle: "AI Assistant",
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(520px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[500px]",
    },
);

export default function AssistantButton() {
    const isDesktop = useIsDesktop();
    const desktopRef = useRef(isDesktop);
    desktopRef.current = isDesktop;
    const t = useIntl();
    const { locale } = useLocale();
    const { theme } = useTheme();
    const [isMobileAssistantShows, setIsMobileAssistantShows] = useState(false);
    const { open, references } = useAssistantLauncher();
    const dismiss = () => useAssistantLauncher.setState({ open: false });
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

    const scopeKey = assistantScope();
    const runtime = useMemo<RuntimeConfig>(
        () => ({
            ...CentAIConfig,
            getExtraPrompt: async () => {
                if (!currentBookId) return undefined;
                if (assistantScope() !== scopeKey)
                    throw new Error("Ledger or account changed");
                const meta = await StorageAPI.getMeta(currentBookId);
                if (assistantScope() !== scopeKey)
                    throw new Error("Ledger or account changed");
                return meta?.personal?.[userId]?.assistant?.extraPrompt;
            },
            provider: createAssistantTokenUsageProvider(
                CentAIConfig.provider,
                (request) =>
                    toTokenUsageApiType(getAIConfig(request.configId).apiType),
            ),
            scope: currentBookId
                ? `${StorageAPI.type}:${currentBookId}`
                : undefined,
            undoChange,
            resolveReferences: async (refs, signal) => {
                const valid = refs.map((ref) => {
                    return ref.type === "cent.bill" &&
                        ref.hostScope === scopeKey
                        ? ref.id
                        : undefined;
                });
                const bills =
                    valid.some(Boolean) && currentBookId
                        ? await StorageDeferredAPI.filter(currentBookId, {})
                        : [];
                signal?.throwIfAborted();
                return refs.map((ref, index) => {
                    const id = valid[index];
                    const { hostScope, ...displayRef } = ref;
                    if (!id || assistantScope() !== scopeKey)
                        return { ref: displayRef, status: "forbidden" };
                    const bill = bills.find((item) => item.id === id);
                    if (!bill) return { ref: displayRef, status: "deleted" };
                    const { images, ...fields } = bill;
                    return {
                        ref: displayRef,
                        status: "ok",
                        bill: fields,
                        imageCount: images?.length ?? 0,
                        amountScale: 10000,
                    };
                });
            },
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
            scopeKey,
            userId,
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
        void promise
            .catch(() => undefined)
            .then(() => {
                setIsMobileAssistantShows(false);
                if (!desktopRef.current)
                    useAssistantLauncher.setState({ open: false });
            });
    }, []);

    useEffect(() => {
        if (isDesktop || !open) dismissMobileAssistantRef.current?.();
        else if (!isMobileAssistantShows) {
            measure("assistant_opened", { surface: "mobile" });
            toShowMobileAssistant();
        }
    }, [isDesktop, open, isMobileAssistantShows, toShowMobileAssistant]);

    return (
        <MainAssistant.Root
            key={assistantScope()}
            runtime={runtime}
            references={references.filter(
                (reference) => reference.hostScope === scopeKey,
            )}
            onReferencesConsumed={() =>
                useAssistantLauncher.setState({ references: [] })
            }
            selectedConfigId={defaultConfigId ?? configs[0]?.id}
            onConfigChange={onConfigChange}
        >
            <AssistantFormProvider />
            {isDesktop && (
                <aside
                    inert={!open}
                    aria-hidden={!open}
                    className={`h-full shrink-0 overflow-hidden transition-[width] duration-250 ease-in-out motion-reduce:transition-none ${open ? "w-[min(400px,48vw)]" : "w-0"}`}
                >
                    <div
                        className={`ml-auto flex h-full w-[min(400px,48vw)] flex-col overflow-hidden border-l transition-opacity duration-200 motion-reduce:transition-none ${open ? "opacity-100" : "opacity-0"}`}
                    >
                        <button
                            type="button"
                            className="self-end px-3"
                            onClick={dismiss}
                            aria-label={t("cancel")}
                        >
                            ×
                        </button>
                        <MainAssistant.Content />
                    </div>
                </aside>
            )}
        </MainAssistant.Root>
    );
}
