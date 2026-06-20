import { getActiveAdapter } from "./registry";

export { getActiveAdapter } from "./registry";
export type { AgentApiAdapter, AgentApiStatus } from "./types";

/**
 * App boot hook: resolve the active adapter and let it set up listeners /
 * auto-start when the user has enabled the feature. No-op when no adapter is
 * supported in the current environment.
 */
export async function bootAgentApi(): Promise<void> {
    const adapter = await getActiveAdapter();
    if (!adapter) return;
    try {
        await adapter.boot?.();
    } catch (e) {
        console.error("[agent-api] boot failed", e);
    }
}
