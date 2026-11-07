import type {
    ContextPolicy,
    History,
    Provider,
    ProviderRequestChunk,
    SkillInput,
    Tool,
} from "@glink25/agent-core";
import type { AIChatToolDefinition } from "@glink25/agent-core/bridge";
import type { ZenStyleName } from "../zen/date";
import type {
    ZenContext,
    ZenFocusDecision,
    ZenPost,
    ZenUIStep,
} from "../zen/types";

export type ZenLocale = "zh" | "en";
export type ZenThemeMode = "light" | "dark" | "system";
export type ZenDirectorMode = "ai" | "local";

export type ZenAIToolDefinition = AIChatToolDefinition;

export type ZenSessionRuntime = {
    provider: Provider;
    tools: Tool[];
    skills: SkillInput[];
};

export type ZenInitPayload = {
    userId: string;
    bookId: string;
    scheduledTime?: string;
    configs: Array<{ id: string; name: string }>;
    defaultConfigId?: string;
    directorMode: ZenDirectorMode;
    aiTools: ZenAIToolDefinition[];
    locale?: ZenLocale;
    theme?: ZenThemeMode;
    style?: ZenStyleName | null;
};

export type ZenRequestHandle = { cancel(): void };

export type ZenPostMutation =
    | { type: "upsert"; post: ZenPost }
    | { type: "delete"; id: string };

/** Component-only capabilities. None of these methods are exposed to the model. */
export type ZenRuntimeHost = {
    getInit(): ZenInitPayload | Promise<ZenInitPayload>;
    getSessionRuntime?(init: ZenInitPayload): ZenSessionRuntime;
    getZenStart?(args: { zenDayId: string }): Promise<{
        completed?: ZenPost;
        latest?: Pick<ZenPost, "completedAt">;
    }>;
    getZenContext(args: {
        zenDayId: string;
        focusDecision?: ZenFocusDecision;
    }): Promise<ZenContext>;
    resolveStepContext?(args: {
        step: ZenUIStep;
        context: ZenContext;
        resources: Map<string, unknown>;
        signal?: AbortSignal;
    }): Promise<ZenContext>;
    listZenPosts(args?: { limit?: number }): Promise<ZenPost[]>;
    mutateZenPosts(args: { mutations: ZenPostMutation[] }): Promise<void>;
    getContextPolicy?: (
        configId?: string,
    ) => ContextPolicy | Promise<ContextPolicy>;
    requestAI?(args: {
        requestId: string;
        configId?: string;
        purpose?: "response" | "summary";
        maxTokens?: number;
        history: History;
        tools: ZenAIToolDefinition[];
        onChunk(chunk: ProviderRequestChunk): void;
        onDone(): void;
        onError(error: unknown): void;
    }): ZenRequestHandle | Promise<ZenRequestHandle>;
    /** Executes only host-injected AI tools. Component capabilities use direct methods above. */
    callAITool?(args: {
        callId: string;
        name: string;
        params: unknown;
        history: History;
    }): Promise<unknown>;
};
