import type { History, ProviderRequestChunk } from "@glink25/chaty";
import type { ZenContext, ZenFocusDecision, ZenPost } from "../zen/types";

export type ZenLocale = "zh" | "en";
export type ZenThemeMode = "light" | "dark" | "system";

export type ZenAIToolDefinition = {
    name: string;
    describe: string;
    argJsonSchema?: Record<string, unknown>;
    returnJsonSchema: Record<string, unknown>;
};

export type ZenInitPayload = {
    userId: string;
    bookId: string;
    scheduledTime?: string;
    configs: Array<{ id: string; name: string }>;
    defaultConfigId?: string;
    aiTools: ZenAIToolDefinition[];
    locale?: ZenLocale;
    theme?: ZenThemeMode;
};

export type ZenRequestHandle = { cancel(): void };

export type ZenPostMutation =
    | { type: "upsert"; post: ZenPost }
    | { type: "delete"; id: string };

/** Component-only capabilities. None of these methods are exposed to the model. */
export type ZenRuntimeHost = {
    getInit(): ZenInitPayload | Promise<ZenInitPayload>;
    getZenContext(args: {
        zenDayId: string;
        focusDecision?: ZenFocusDecision;
    }): Promise<ZenContext>;
    listZenPosts(args?: { limit?: number }): Promise<ZenPost[]>;
    mutateZenPosts(args: { mutations: ZenPostMutation[] }): Promise<void>;
    requestAI(args: {
        requestId: string;
        configId?: string;
        history: History;
        tools: ZenAIToolDefinition[];
        onChunk(chunk: ProviderRequestChunk): void;
        onDone(): void;
        onError(error: unknown): void;
    }): ZenRequestHandle | Promise<ZenRequestHandle>;
    /** Executes only host-injected AI tools. Component capabilities use direct methods above. */
    callAITool(args: {
        callId: string;
        name: string;
        params: unknown;
        history: History;
    }): Promise<unknown>;
};

export type NativeBridgeMessage =
    | { id: string; type: "getInit" }
    | {
          id: string;
          type: "getZenContext";
          payload: { zenDayId: string; focusDecision?: ZenFocusDecision };
      }
    | { id: string; type: "listZenPosts"; payload: { limit?: number } }
    | {
          id: string;
          type: "mutateZenPosts";
          payload: { mutations: ZenPostMutation[] };
      }
    | {
          id: string;
          type: "requestAI";
          payload: {
              requestId: string;
              configId?: string;
              history: History;
              tools: ZenAIToolDefinition[];
          };
      }
    | { id: string; type: "cancelAIRequest"; payload: { requestId: string } }
    | {
          id: string;
          type: "callAITool";
          payload: {
              callId: string;
              name: string;
              params: unknown;
              history: History;
          };
      };

export type NativeCallback = {
    resolve?(value: unknown): void;
    reject?(error: unknown): void;
    onChunk?(chunk: ProviderRequestChunk): void;
    onDone?(): void;
    onError?(error: unknown): void;
};
