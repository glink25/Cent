import {
    getZenPostDayId,
    resolveZenDirectorConfig,
    Zen,
    type ZenRuntimeHost,
} from "@glink25/zen";
import { useEffect, useRef, useState } from "react";
import { CentReviewAgentConfig } from "@/agent/runtime";
import { agentLedgerScope } from "@/agent/web-host";
import { loadStorageAPI } from "@/api/storage/dynamic";
import { getAIConfig } from "@/components/assistant/request";
import { CentAIProvider } from "@/components/assistant/tools/provider";
import createConfirmProvider from "@/components/confirm";
import { measure } from "@/measurement";
import {
    beginZenTokenUsage,
    completeZenTokenUsage,
    createZenTokenUsageProvider,
    interruptZenTokenUsage,
    toTokenUsageApiType,
} from "@/measurement/token-usage";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { usePreferenceStore } from "@/store/preference";
import { useUserStore } from "@/store/user";
import { buildZenContext } from "./analyzer";
import { resolveZenStepContext } from "./step-context";
import { readRecentZenPosts, readZenPost } from "./storage";

export function createCentZenHost(): ZenRuntimeHost {
    const bookId = useBookStore.getState().currentBookId ?? "";
    const userId = String(useUserStore.getState().id);
    const scope = agentLedgerScope();
    const assertScope = () => {
        if (scope !== agentLedgerScope())
            throw new Error("Ledger or account changed");
    };

    return {
        getInit() {
            assertScope();
            const personal =
                useLedgerStore.getState().infos?.meta.personal?.[userId];
            const configs = personal?.assistant?.configs ?? [];
            const { configId: defaultConfigId, directorMode } =
                resolveZenDirectorConfig({
                    configs,
                    aiConfigId: personal?.zen?.aiConfigId,
                    defaultConfigId: personal?.assistant?.defaultConfigId,
                });
            const selected = configs.find(
                (config) => config.id === defaultConfigId,
            );
            beginZenTokenUsage(
                directorMode === "local" || !selected
                    ? "local"
                    : toTokenUsageApiType(selected.apiType),
            );
            const theme = localStorage.getItem("theme");
            return {
                userId,
                bookId,
                scheduledTime: personal?.zen?.scheduledTime ?? "21:00",
                configs: configs.map(({ id, name }) => ({ id, name })),
                defaultConfigId,
                directorMode,
                aiTools: [],
                locale: usePreferenceStore.getState().locale,
                theme: theme === "dark" || theme === "light" ? theme : "system",
            };
        },
        getSessionRuntime({ defaultConfigId }) {
            const provider = createZenTokenUsageProvider(CentAIProvider, () =>
                toTokenUsageApiType(getAIConfig(defaultConfigId).apiType),
            );
            return {
                ...CentReviewAgentConfig,
                tools: CentReviewAgentConfig.tools.map((tool) => ({
                    ...tool,
                    async handler(args, context) {
                        assertScope();
                        const result = await tool.handler(args, context);
                        assertScope();
                        return result;
                    },
                })),
                provider: {
                    getContextPolicy(configId) {
                        assertScope();
                        return provider.getContextPolicy?.(configId) ?? {};
                    },
                    request(request) {
                        assertScope();
                        return provider.request(request);
                    },
                },
            };
        },
        async getZenStart({ zenDayId }) {
            assertScope();
            const [completed, [latest]] = await Promise.all([
                readZenPost(bookId, userId, zenDayId),
                readRecentZenPosts(
                    bookId,
                    userId,
                    1,
                    `zen-${zenDayId}-${userId}`,
                ),
            ]);
            assertScope();
            return {
                completed,
                latest: latest && { completedAt: latest.completedAt },
            };
        },
        async getZenContext({ zenDayId, focusDecision }) {
            assertScope();
            const { StorageDeferredAPI } = await loadStorageAPI();
            const [bills, { meta }, recentZenPosts] = await Promise.all([
                StorageDeferredAPI.readAllBills(bookId),
                StorageDeferredAPI.getInfo(bookId),
                readRecentZenPosts(
                    bookId,
                    userId,
                    1,
                    `zen-${zenDayId}-${userId}`,
                ),
            ]);
            assertScope();
            return buildZenContext({
                zenDayId,
                bills,
                meta,
                recentZenPosts,
                focusDecision,
            });
        },
        async resolveStepContext({ step, context, resources, signal }) {
            assertScope();
            const result = await resolveZenStepContext(
                step,
                context,
                resources,
            );
            signal?.throwIfAborted();
            assertScope();
            return result;
        },
        async listZenPosts({ limit } = {}) {
            assertScope();
            if (!bookId) return [];
            if (limit !== undefined) {
                const posts = await readRecentZenPosts(bookId, userId, limit);
                assertScope();
                return posts;
            }
            const { StorageAPI } = await loadStorageAPI();
            const posts = await StorageAPI.getAllZenItems(bookId);
            assertScope();
            return posts
                .filter((post) => String(post.userId) === userId)
                .sort(
                    (a, b) =>
                        getZenPostDayId(b).localeCompare(getZenPostDayId(a)) ||
                        b.completedAt - a.completedAt,
                );
        },
        async mutateZenPosts({ mutations }) {
            assertScope();
            if (!bookId) throw new Error("No active ledger book");
            const { StorageAPI } = await loadStorageAPI();
            assertScope();
            await StorageAPI.batchZen(
                bookId,
                mutations.map((mutation) =>
                    mutation.type === "delete"
                        ? { type: "delete" as const, value: mutation.id }
                        : { type: "update" as const, value: mutation.post },
                ),
            );
            if (mutations.some((mutation) => mutation.type === "upsert")) {
                measure("zen_completed");
                completeZenTokenUsage();
            }
        },
    };
}

function ZenHostForm({ onCancel }: { onCancel?: () => void }) {
    const [host] = useState(createCentZenHost);
    const frame = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const viewport = window.visualViewport;
        const element = frame.current;
        if (!viewport || !element) return;

        const fitViewport = () => {
            // Mobile keyboards can shrink the visual viewport without resizing the dialog.
            element.style.maxHeight =
                viewport.scale === 1 ? `${viewport.height}px` : "";
        };
        fitViewport();
        viewport.addEventListener("resize", fitViewport);
        return () => viewport.removeEventListener("resize", fitViewport);
    }, []);

    const handleClose = () => {
        interruptZenTokenUsage();
        onCancel?.();
    };
    return (
        <div ref={frame} className="h-full w-full">
            <Zen host={host} onClose={handleClose} />
        </div>
    );
}

export const [ZenDialogProvider, showZenDialog] = createConfirmProvider(
    ZenHostForm,
    {
        dialogTitle: "Zen Mode",
        dialogModalClose: false,
        swipe: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none overflow-hidden",
    },
);
