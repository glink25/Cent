import type { ComponentType } from "react";

export type AgentApiStatus = {
    running: boolean;
    /** Base URL, when the adapter exposes an addressable endpoint. */
    url?: string;
    /** Listening port, for local-server style adapters. */
    port?: number;
    /** Optional human-readable detail (e.g. error or extra status). */
    detail?: string;
};

/**
 * A platform-specific transport that exposes the agent-api core
 * (`./core`) to external AI agents.
 *
 * Adapters are registered in `./registry`. The first one whose
 * `isSupported()` resolves to `true` becomes active; if none is
 * supported the feature is hidden entirely.
 */
export type AgentApiAdapter = {
    /** Stable id, e.g. "web-mcp" | "tauri-server". */
    id: string;
    /** Whether this adapter can run in the current environment. */
    isSupported(): Promise<boolean>;
    start(): Promise<AgentApiStatus>;
    stop(): Promise<void>;
    getStatus(): Promise<AgentApiStatus>;
    /**
     * Called once at app boot (via `bootAgentApi`). Adapters use this to
     * install listeners and auto-start when the user has enabled the feature.
     */
    boot?(): Promise<void>;
    /** Adapter-owned settings UI, rendered inside the shared shell. */
    SettingsView: ComponentType<{ onCancel?: () => void }>;
};
