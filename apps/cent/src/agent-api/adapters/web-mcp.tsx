import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { useAgentApiStore } from "@/store/agent-api";
import { callTool, getToolList } from "../core";
import type { AgentApiAdapter, AgentApiStatus } from "../types";

/**
 * Web MCP adapter.
 *
 * Exposes the agent-api core tools to an AI agent through the experimental
 * Web MCP surface (`document.modelContext`, see
 * https://github.com/webmachinelearning/webmcp). Each `CentAIConfig` tool is
 * registered via `modelContext.registerTool(def, { signal })` and dispatched
 * through `core.callTool`. Tools are removed by aborting the shared signal.
 */

// --- Web MCP typings (subset of the proposal we rely on) -------------------

type McpToolResult = {
    content: Array<{ type: "text"; text: string }>;
    structuredContent?: unknown;
    isError?: boolean;
};

type McpToolDefinition = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
    execute: (args: Record<string, unknown>) => Promise<McpToolResult>;
};

type ModelContext = {
    registerTool: (
        def: McpToolDefinition,
        options?: { signal?: AbortSignal },
    ) => unknown;
};

/**
 * This adapter only governs the web platform: when running inside the native
 * app (Tauri), the desktop server adapter is responsible for the feature, so
 * "webmcp unsupported → hide the setting" must apply on web only.
 */
function isWebPlatform(): boolean {
    return (
        typeof window !== "undefined" &&
        !(window as { __TAURI__?: unknown }).__TAURI__
    );
}

function getModelContext(): ModelContext | undefined {
    const candidate =
        (typeof document !== "undefined" &&
            (document as unknown as { modelContext?: ModelContext })
                .modelContext) ||
        (typeof navigator !== "undefined" &&
            (navigator as unknown as { modelContext?: ModelContext })
                .modelContext) ||
        undefined;
    return candidate && typeof candidate.registerTool === "function"
        ? candidate
        : undefined;
}

const EMPTY_INPUT_SCHEMA: Record<string, unknown> = {
    type: "object",
    properties: {},
};

// --- Registration lifecycle ------------------------------------------------

let abort: AbortController | null = null;

function isRegistered(): boolean {
    return abort !== null;
}

async function register(): Promise<boolean> {
    const mc = getModelContext();
    if (!mc) return false;
    // Re-register cleanly so a re-enable / hot reload doesn't double up.
    abort?.abort();
    abort = new AbortController();
    const { signal } = abort;

    const { tools } = getToolList();
    for (const tool of tools) {
        const inputSchema =
            (tool.argSchema as Record<string, unknown> | null) ??
            EMPTY_INPUT_SCHEMA;
        mc.registerTool(
            {
                name: tool.name,
                description: tool.describe || tool.name,
                inputSchema,
                async execute(args) {
                    try {
                        const data = await callTool(tool.name, args);
                        const text =
                            typeof data === "string"
                                ? data
                                : JSON.stringify(data ?? null);
                        return {
                            content: [{ type: "text", text }],
                            structuredContent:
                                data && typeof data === "object"
                                    ? data
                                    : undefined,
                        };
                    } catch (e) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text:
                                        e instanceof Error
                                            ? e.message
                                            : String(e),
                                },
                            ],
                            isError: true,
                        };
                    }
                },
            },
            { signal },
        );
    }
    return true;
}

function unregister(): void {
    abort?.abort();
    abort = null;
}

// --- Install prompt --------------------------------------------------------

export function buildWebMcpPrompt(): string {
    const { tools } = getToolList();
    const lines = [
        "我在浏览器中打开了一款叫 Cent 的记账应用，它已通过 WebMCP（`document.modelContext`）在当前网页注册了一组工具，你可以直接调用它们来帮我查询和分析账单。",
        "",
        "请使用你的浏览器 / WebMCP 工具调用能力直接调用这些工具，无需任何服务地址或 Token。",
        "",
        "可用工具：",
        "",
        ...tools.map((t) => `- \`${t.name}\`：${t.describe || "（无描述）"}`),
        "",
        "> ⚠️ 这些工具仅在 Cent 网页处于打开状态时可用。若调用失败，请提示我先打开 Cent 页面，并确认已在「设置 → Agent API」中启用该功能。",
    ];
    return lines.join("\n");
}

// --- Settings UI -----------------------------------------------------------

function SettingsView({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const { enabled } = useAgentApiStore();
    const [busy, setBusy] = useState(false);

    const handleToggle = useCallback(
        async (next: boolean) => {
            if (busy) return;
            setBusy(true);
            try {
                if (next) {
                    const ok = await register();
                    if (!ok) throw new Error(t("agent-api-webmcp-unavailable"));
                    useAgentApiStore.setState({ enabled: true });
                } else {
                    unregister();
                    useAgentApiStore.setState({ enabled: false });
                }
            } catch (e) {
                toast.error(e instanceof Error ? e.message : String(e));
            } finally {
                setBusy(false);
            }
        },
        [busy, t],
    );

    const handleCopyPrompt = useCallback(async () => {
        if (busy) return;
        setBusy(true);
        try {
            // Make sure the tools are actually registered before handing the
            // prompt over, so the agent finds them on first call.
            if (!isRegistered()) {
                const ok = await register();
                if (!ok) throw new Error(t("agent-api-webmcp-unavailable"));
                useAgentApiStore.setState({ enabled: true });
            }
            await navigator.clipboard.writeText(buildWebMcpPrompt());
            toast.success(t("agent-api-prompt-copied"));
        } catch (e) {
            toast.error(e instanceof Error ? e.message : String(e));
        } finally {
            setBusy(false);
        }
    }, [busy, t]);

    return (
        <PopupLayout
            title={t("agent-api")}
            onBack={onCancel}
            className="h-full overflow-hidden"
        >
            <div className="flex-1 flex flex-col gap-4 px-4 py-4 overflow-y-auto">
                <div className="text-xs opacity-70">
                    {t("agent-api-webmcp-description")}
                </div>

                <div className="flex items-center justify-between border rounded-md px-3 py-2">
                    <div className="flex flex-col">
                        <div className="text-sm font-medium">
                            {t("agent-api-enable")}
                        </div>
                        <div className="text-xs opacity-60">
                            {enabled
                                ? t("agent-api-status-running")
                                : t("agent-api-status-stopped")}
                        </div>
                    </div>
                    <Switch
                        checked={enabled}
                        disabled={busy}
                        onCheckedChange={handleToggle}
                    />
                </div>

                <Button
                    variant="default"
                    className="w-full"
                    onClick={handleCopyPrompt}
                    disabled={busy}
                >
                    <i className="icon-[mdi--content-copy] size-4 mr-1"></i>
                    {t("agent-api-copy-prompt")}
                </Button>

                <div className="text-xs opacity-60">
                    {t("agent-api-webmcp-hint")}
                </div>
            </div>
        </PopupLayout>
    );
}

// 暂时关闭Web MCP agent api，等待后续正式协议确定
const DISABLE_WEB_AGENT = true;

export const webMcpAdapter: AgentApiAdapter = {
    id: "web-mcp",
    async isSupported() {
        if (DISABLE_WEB_AGENT) {
            return false;
        }
        return isWebPlatform() && !!getModelContext();
    },
    async start() {
        await register();
        return { running: isRegistered() };
    },
    async stop() {
        unregister();
    },
    async getStatus(): Promise<AgentApiStatus> {
        return { running: isRegistered() };
    },
    async boot() {
        if (!isWebPlatform() || !getModelContext()) return;
        const { enabled } = useAgentApiStore.getState();
        if (enabled) await register();
    },
    SettingsView,
};
