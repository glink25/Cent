import type { History, ProviderRequestChunk } from "./core";

export type AIChatConfig = {
    id: string;
    name: string;
};

export type AIChatPresetPrompt = {
    id: string;
    label: string;
    prompt: string;
};

export type AIChatToolDefinition = {
    name: string;
    describe: string;
    argJsonSchema?: Record<string, unknown>;
    returnJsonSchema: Record<string, unknown>;
};

export type AIChatSkillDefinition = {
    id: string;
    name: string;
    description: string;
    content?: string;
};

export type AIChatInitPayload = {
    configs: AIChatConfig[];
    defaultConfigId?: string;
    systemPrompt: string;
    presetPrompts: AIChatPresetPrompt[];
    tools: AIChatToolDefinition[];
    skills: AIChatSkillDefinition[];
    locale?: "zh" | "en";
    theme?: "light" | "dark" | "system";
};

export type HostRequestHandle = {
    cancel: () => void;
};

export type HostBridge = {
    getInit?: () => AIChatInitPayload | Promise<AIChatInitPayload>;
    requestAI(args: {
        requestId: string;
        configId?: string;
        history: History;
        onChunk: (chunk: ProviderRequestChunk) => void;
        onDone: () => void;
        onError: (error: unknown) => void;
    }): HostRequestHandle | Promise<HostRequestHandle>;
    callTool(args: {
        callId: string;
        name: string;
        params: unknown;
        history: History;
    }): Promise<unknown>;
    loadSkill?(args: { id: string }): Promise<AIChatSkillDefinition>;
};

export type AIChatParentMessage =
    | { type: "cent-ai-chat:init"; payload: AIChatInitPayload }
    | {
          type: "cent-ai-chat:request-chunk";
          requestId: string;
          chunk: ProviderRequestChunk;
      }
    | { type: "cent-ai-chat:request-done"; requestId: string }
    | { type: "cent-ai-chat:request-error"; requestId: string; error: unknown }
    | {
          type: "cent-ai-chat:tool-result";
          callId: string;
          success: boolean;
          result?: unknown;
          error?: unknown;
      }
    | {
          type: "cent-ai-chat:skill-result";
          callId: string;
          success: boolean;
          result?: AIChatSkillDefinition;
          error?: unknown;
      };

export type AIChatChildMessage =
    | { type: "cent-ai-chat:init-request" }
    | {
          type: "cent-ai-chat:request-ai";
          requestId: string;
          configId?: string;
          history: History;
      }
    | { type: "cent-ai-chat:request-cancel"; requestId: string }
    | {
          type: "cent-ai-chat:tool-call";
          callId: string;
          name: string;
          params: unknown;
          history: History;
      }
    | { type: "cent-ai-chat:skill-call"; callId: string; id: string };

declare global {
    interface Window {
        CentAIChatHost?: HostBridge;
    }
}
