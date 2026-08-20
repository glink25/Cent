import type { Tool } from "@glink25/chaty";
import {
    getZenPostDayId,
    resolveZenDirectorConfig,
    Zen,
    type ZenAIToolDefinition,
    type ZenRuntimeHost,
} from "@glink25/zen";
// 注意：不再 import "@glink25/zen/styles.css"（那是 zen 的 tailwind-root，会引入第二份
// Tailwind）。zen 的工具类由 cent 自身 Tailwind 扫描 zen 源码统一生成；zen 的纯 CSS
// 主题（zen.css）已随 `@glink25/zen` 源码入口自动引入。
import { z } from "zod";
import { loadStorageAPI } from "@/api/storage/dynamic";
import { getAIConfig } from "@/components/assistant/request";
import {
    AnalyzeBillsTool,
    GetAccountMetaTool,
    QueryBillsTool,
} from "@/components/assistant/tools/ledger-tools";
import { createCentAIProvider } from "@/components/assistant/tools/provider";
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

const hostAITools = [
    AnalyzeBillsTool,
    QueryBillsTool,
    GetAccountMetaTool,
] as unknown as Tool[];

function serializeTool(tool: Tool): ZenAIToolDefinition {
    return {
        name: tool.name,
        describe: tool.describe,
        argJsonSchema: tool.argSchema
            ? (z.toJSONSchema(tool.argSchema) as Record<string, unknown>)
            : undefined,
        returnJsonSchema: z.toJSONSchema(tool.returnSchema) as Record<
            string,
            unknown
        >,
    };
}

function deserializeTool(definition: ZenAIToolDefinition): Tool {
    return {
        name: definition.name,
        describe: definition.describe,
        argSchema: definition.argJsonSchema
            ? z.fromJSONSchema(definition.argJsonSchema)
            : undefined,
        returnSchema: z.fromJSONSchema(definition.returnJsonSchema),
        handler: () => {
            throw new Error(
                "AI response tools are executed by the Zen session",
            );
        },
    };
}

async function listPosts(limit?: number) {
    const bookId = useBookStore.getState().currentBookId;
    if (!bookId) return [];
    const userId = String(useUserStore.getState().id);
    const { StorageAPI } = await loadStorageAPI();
    const posts = await StorageAPI.getAllZenItems(bookId);
    const ownPosts = posts
        .filter((post) => String(post.userId) === userId)
        .sort(
            (a, b) =>
                getZenPostDayId(b).localeCompare(getZenPostDayId(a)) ||
                b.completedAt - a.completedAt,
        );
    return limit ? ownPosts.slice(0, limit) : ownPosts;
}

export const centZenHost: ZenRuntimeHost = {
    async getInit() {
        const userId = useUserStore.getState().id;
        const bookId = useBookStore.getState().currentBookId ?? "";
        const personal =
            useLedgerStore.getState().infos?.meta.personal?.[userId];
        const configs = personal?.assistant?.configs ?? [];
        const configuredZenId = personal?.zen?.aiConfigId;
        const { configId: defaultConfigId, directorMode } =
            resolveZenDirectorConfig({
                configs,
                aiConfigId: configuredZenId,
                defaultConfigId: personal?.assistant?.defaultConfigId,
            });
        const selectedConfig = configs.find(
            (config) => config.id === defaultConfigId,
        );
        beginZenTokenUsage(
            directorMode === "local" || !selectedConfig
                ? "local"
                : toTokenUsageApiType(selectedConfig.apiType),
        );
        const storedTheme = localStorage.getItem("theme");
        return {
            userId: String(userId),
            bookId,
            scheduledTime: personal?.zen?.scheduledTime ?? "21:00",
            configs: configs.map(({ id, name }) => ({ id, name })),
            defaultConfigId,
            directorMode,
            aiTools: hostAITools.map(serializeTool),
            locale: usePreferenceStore.getState().locale,
            theme:
                storedTheme === "dark" || storedTheme === "light"
                    ? storedTheme
                    : "system",
        };
    },
    async getZenContext({ zenDayId, focusDecision }) {
        const ledger = useLedgerStore.getState();
        const bills = await ledger.refreshBillList();
        return buildZenContext({
            zenDayId,
            bills,
            meta: useLedgerStore.getState().infos?.meta,
            recentZenPosts: await listPosts(),
            focusDecision,
        });
    },
    listZenPosts: ({ limit } = {}) => listPosts(limit),
    async mutateZenPosts({ mutations }) {
        const bookId = useBookStore.getState().currentBookId;
        if (!bookId) throw new Error("No active ledger book");
        const { StorageAPI } = await loadStorageAPI();
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
    requestAI({
        requestId: _requestId,
        configId,
        history,
        tools,
        onChunk,
        onDone,
        onError,
    }) {
        const provider = createCentAIProvider(() => configId);
        const observedProvider = createZenTokenUsageProvider(provider, () =>
            toTokenUsageApiType(getAIConfig(configId).apiType),
        );
        const stream = observedProvider.request({
            history,
            configId,
            tools: tools.map(deserializeTool),
        });
        void stream
            .then(async (chunks) => {
                for await (const chunk of chunks) onChunk(chunk);
                onDone();
            })
            .catch(onError);
        return { cancel: () => stream.abort() };
    },
    async callAITool({ name, params, history }) {
        const tool = hostAITools.find((item) => item.name === name);
        if (!tool) throw new Error(`Unknown host AI tool: ${name}`);
        return tool.handler(params, { history, tools: hostAITools });
    },
};

function ZenHostForm({ onCancel }: { onCancel?: () => void }) {
    const handleClose = () => {
        interruptZenTokenUsage();
        onCancel?.();
    };
    return <Zen host={centZenHost} onClose={handleClose} />;
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
