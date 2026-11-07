import { adaptHostRuntime } from "@glink25/agent-core/bridge";
import {
    getAndroidNativeHost,
    getIosNativeHost,
} from "@glink25/agent-core/bridge/native-host";
import type { AIChatInitPayload } from "@glink25/agent-core/bridge/types";
import {
    PlaygroundSkill,
    PlaygroundTool,
} from "@glink25/agent-core/playground";
import type { ZenRuntimeHost } from "./types";

const nativeHost = () => getAndroidNativeHost() ?? getIosNativeHost();

export function requestHostClose() {
    nativeHost()?.closeZen?.();
}

export function getNativeZenHost(): ZenRuntimeHost | undefined {
    const host = nativeHost();
    const call = host?.zen;
    const getInit = host?.getInit;
    if (!host || !getInit || !call) return undefined;
    let init: AIChatInitPayload;
    return {
        async getInit() {
            init = await getInit();
            if (init.surface !== "zen" || !init.zen)
                throw new Error("Native host did not initialize Zen");
            return {
                ...init.zen,
                style: init.zen.style as Awaited<
                    ReturnType<ZenRuntimeHost["getInit"]>
                >["style"],
                configs: init.configs,
                defaultConfigId: init.defaultConfigId,
                locale: init.locale,
                theme: init.theme,
                aiTools: [],
            };
        },
        getSessionRuntime() {
            return adaptHostRuntime(
                host,
                {
                    ...init,
                    tools: init.tools.filter((tool) => tool.effect === "read"),
                    changeSupport: false,
                    writeBatchSupport: false,
                },
                { tools: [PlaygroundTool], skills: [PlaygroundSkill] },
            );
        },
        async getZenStart(params) {
            const result = await call<
                Awaited<ReturnType<NonNullable<ZenRuntimeHost["getZenStart"]>>>
            >("getZenStart", params);
            return {
                completed: result.completed ?? undefined,
                latest: result.latest ?? undefined,
            };
        },
        getZenContext: (params) => call("getZenContext", params),
        listZenPosts: (params) => call("listZenPosts", params),
        mutateZenPosts: (params) => call("mutateZenPosts", params),
        async resolveStepContext({ step, context, signal }) {
            const evidence = await call<
                Pick<
                    typeof context,
                    "candidateBills" | "topCategories" | "budgets" | "summary"
                >
            >(
                "resolveZenStepContext",
                {
                    period: context.period,
                    blocks: step.content.filter(
                        (block) => block.type === "entityList",
                    ),
                },
                signal,
            );
            return { ...context, ...evidence };
        },
    };
}
