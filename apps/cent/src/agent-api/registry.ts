import { webMcpAdapter } from "./adapters/web-mcp";
import type { AgentApiAdapter } from "./types";

/**
 * Registered adapters, in priority order. The first one whose
 * `isSupported()` resolves to `true` wins.
 *
 * NOTE: the `tauri` branch appends `tauriServerAdapter` here — keep this the
 * single edit point so re-flowing the desktop adapter stays a one-line change.
 */
const adapters: AgentApiAdapter[] = [webMcpAdapter];

let resolved: AgentApiAdapter | null | undefined;

/** Resolve (and cache) the active adapter, or `null` if none is supported. */
export async function getActiveAdapter(): Promise<AgentApiAdapter | null> {
    if (resolved !== undefined) return resolved;
    for (const adapter of adapters) {
        try {
            if (await adapter.isSupported()) {
                resolved = adapter;
                return adapter;
            }
        } catch {
            /* probe failures mean "not supported" */
        }
    }
    resolved = null;
    return null;
}
