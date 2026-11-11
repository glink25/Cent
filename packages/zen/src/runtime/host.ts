import { withToolImages } from "@glink25/agent-core";
import { createHostProvider, createHostTool } from "@glink25/agent-core/bridge";
import { getNativeZenHost } from "./native-host";
import type { ZenRuntimeHost, ZenSessionRuntime } from "./types";

function sameOriginParentHost() {
    if (window.parent === window) return undefined;
    try {
        return window.parent.ZenHost;
    } catch {
        return undefined;
    }
}

export function getHostBridge(): ZenRuntimeHost | undefined {
    return window.ZenHost ?? sameOriginParentHost() ?? getNativeZenHost();
}

export async function loadRuntime(host: ZenRuntimeHost) {
    const init = await host.getInit();
    if (init.directorMode === "local") return { init };

    let session: ZenSessionRuntime | undefined = host.getSessionRuntime?.(init);
    if (!session) {
        const requestAI = host.requestAI?.bind(host);
        const callTool = host.callAITool?.bind(host);
        if (!requestAI || !callTool)
            throw new Error("Zen AI runtime is unavailable");
        session = {
            provider: createHostProvider({
                requestAI: (request) =>
                    requestAI({
                        ...request,
                        history:
                            request.purpose === "summary"
                                ? request.history
                                : withToolImages(request.history),
                    }),
                getContextPolicy: host.getContextPolicy?.bind(host),
            }),
            tools: init.aiTools
                .filter(
                    (tool) =>
                        tool.effect !== "write" || tool.name === "playground",
                )
                .map((tool) =>
                    createHostTool(
                        {
                            callTool: ({ callId, name, params, history }) =>
                                callTool({ callId, name, params, history }),
                        },
                        { ...tool, effect: tool.effect ?? "read" },
                    ),
                ),
            skills: [],
        };
    }
    const reserved = new Set([
        "showZenStep",
        "decideZenFocus",
        "readZenHistory",
    ]);
    const conflict = session.tools.find((tool) => reserved.has(tool.name));
    if (conflict)
        throw new Error(`Host AI tool name is reserved: ${conflict.name}`);
    return { init, session };
}

declare global {
    interface Window {
        ZenHost?: ZenRuntimeHost;
    }
}
