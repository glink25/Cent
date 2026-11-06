export type ChangeProposal = {
    id: string;
    title: string;
    canRemember?: boolean;
    diffs: { target: string; before?: unknown; after?: unknown }[];
};

export type ChangeReceipt = {
    kind: "changeReceipt";
    proposal: ChangeProposal;
    status:
        | "applied"
        | "rejected"
        | "expired"
        | "conflict"
        | "partial"
        | "failed"
        | "undone";
    results: { target: string; status: "applied" | "unchanged" | "unknown" }[];
    undo?: "direct" | "agent";
};

export type ApproveChange = (
    proposal: ChangeProposal,
    signal?: AbortSignal,
    call?: { id: string; name: string },
) => Promise<{ approved: boolean; remember?: boolean }>;

import type { ZodType, z } from "zod";

export type ConversationReference = {
    type: string;
    id: string;
    label: string;
    hostScope?: string;
};

export type ReferenceResolver = (
    references: ConversationReference[],
    signal?: AbortSignal,
) => Promise<unknown[]>;

export type UserMessage = {
    /** Original attachment numbering, preserved in context projections. */
    assetStartIndex?: number;
    elapsedMs?: number;
    sentAt?: number;
    turnStatus?: "completed" | "failed" | "cancelled";
    id?: string;
    role: "user";
    raw: string;
    assets?: File[];
    toolImages?: import("./tool-images").ToolImage[];
    references?: ConversationReference[];
};

export type AssistantMessage = {
    id?: string;
    role: "assistant";
    raw: string;
    formatted: {
        thought?: string;
        answer?: string;
        overview?: string;
        tools?: ProviderToolCall[];
    };
};

export type ToolMessage = {
    /** Protocol-only placeholder for a call interrupted before completion. */
    internal?: boolean;
    /** Request-only serialized observation, never added to the original history. */
    contextContent?: string;
    id?: string;
    role: "tool";
    raw: string;
    formatted: {
        /** 原生 tool_call_id，用于把工具结果回传给对应的 assistant 调用。 */
        id?: string;
        name: string;
        params: unknown;
        returns?: unknown;
        errors?: unknown;
        runningTime?: number;
    };
};

export type SystemMessage = {
    id?: string;
    role: "system";
    raw: string;
};

export type Message =
    | UserMessage
    | AssistantMessage
    | ToolMessage
    | SystemMessage;
export type History = Message[];

export type Chat = {
    id: string;
    history: History;
};

export type AbortablePromise<T = unknown> = Promise<T> & {
    abort: () => void;
};

export type ContextPolicy = {
    contextWindow?: number;
    maxOutputTokens?: number;
    safetyTokens?: number;
    toolResultChars?: number;
    keepTurns?: number;
    summaryTimeoutMs?: number;
};

export type ContextState = {
    version: 1;
    summary: string;
    coveredThroughId: string;
    sourceDigest: string;
    compactions: number;
};

export type ContextEvent = {
    id: string;
    anchorId: string;
    coveredThroughId?: string;
    summary?: string;
};

export type ContextMetrics = {
    estimatedInputTokens: number;
    inputBudget: number;
    compactions: number;
    summaryDurationMs?: number;
};

export type ProviderRequest = {
    purpose?: "response" | "summary";
    maxTokens?: number;
    history: History;
    configId?: string;
    /** 本会话注册的全部工具，Provider/Host 据此构造请求的原生 `tools` 字段。 */
    tools: Tool[];
};

/** 一次原生工具调用（OpenAI tool_call / Google functionCall 归一化后的形态）。 */
export type ProviderToolCall = {
    id: string;
    name: string;
    params: unknown;
    /**
     * Gemini 思考模型会给每个 functionCall 附带 thoughtSignature，回传对话时必须
     * 原样带回，否则 400。仅 Google 类 host 使用，其它协议忽略。
     */
    thoughtSignature?: string;
};

export type ToolDisplay = {
    label?: string;
    icon?: string;
    summarize?: (params: unknown) => string;
};

export type RunActivity = {
    phase: "thinking" | "answering" | "preparing" | "executing";
    messageId?: string;
    callId?: string;
    name?: string;
    params?: unknown;
};

export type ProviderRequestChunk = {
    toolProgress?: { id: string; name: string; argumentsPreview?: string };
    usage?: { inputTokens?: number; outputTokens?: number };
    protocolError?: {
        code:
            | "INCOMPLETE_TOOL_CALL"
            | "INVALID_TOOL_ARGUMENTS"
            | "OUTPUT_LENGTH";
        message: string;
    };
    thought?: string;
    answer: string;
    /** 仅在流结束、参数完整时填充。 */
    toolCalls?: ProviderToolCall[];
    finishReason?: "stop" | "tool_calls" | "length" | (string & {});
};

export type Provider = {
    /** Resolve the selected model's effective window/output settings. */
    getContextPolicy?: (
        configId?: string,
    ) => ContextPolicy | Promise<ContextPolicy>;
    request: (
        params: ProviderRequest,
    ) => AbortablePromise<AsyncIterable<ProviderRequestChunk>>;
};

export type TurnResult = {
    activity?: RunActivity;
    contextState?: ContextState;
    contextEvent?: ContextEvent;
    contextStatus?: "compacting" | "ready" | "deferred";
    contextMetrics?: ContextMetrics;
    status?: "running" | "completed" | "failed" | "cancelled";
    activeTool?: string;
    history: History;
};

export type ZodLikeSchema = ZodType;

export type MinimalSchema<T = unknown> = {
    safeParse: (value: unknown) =>
        | {
              success: true;
              data: T;
          }
        | {
              success: false;
              error: unknown;
          };
};

export type ToolSchema = ZodLikeSchema;

export type ToolJsonSchema = Record<string, unknown>;

export type ToolPromptDefinition = string;

export type ToolExposure = { code: boolean; native: boolean };

export type ToolContext = {
    approveChange?: ApproveChange;
    source?: "webmcp";
    resources?: Map<string, unknown>;
    signal?: AbortSignal;
    surface?: "code" | "native";
    history: History;
    /**
     * 当前会话注册的全部工具（实际的 Tool 对象，含 handler）。
     * 某个工具（如 playground）可据此发现并调用其它工具，无需任何硬编码。
     */
    tools: Tool[];
};

export type Tool<Args = unknown, Returns = unknown> = {
    display?: ToolDisplay;
    exposure?: ToolExposure;
    effect?: "read" | "write" | "ui";
    endsTurn?: boolean;
    name: string;
    describe: string;
    argSchema?: ToolSchema;
    returnSchema: ToolSchema;
    handler: (
        arg: Args | undefined,
        ctx: ToolContext,
    ) => Returns | Promise<Returns>;
};

export type CreateToolInput<
    ArgsSchema extends ZodLikeSchema | undefined,
    ReturnSchema extends ZodLikeSchema,
> = {
    display?: ToolDisplay;
    exposure?: ToolExposure;
    effect?: "read" | "write" | "ui";
    endsTurn?: boolean;
    name: string;
    describe: string;
    argSchema?: ArgsSchema;
    returnSchema: ReturnSchema;
    handler: (
        arg: ArgsSchema extends undefined ? undefined : z.infer<ArgsSchema>,
        ctx: ToolContext,
    ) => z.infer<ReturnSchema> | Promise<z.infer<ReturnSchema>>;
};

export type SkillMeta = {
    /**
     * Stable identifier for the skill.
     * Recommended: short, url-safe string (e.g. "sql-guide", "my-skill").
     */
    id: string;
    name: string;
    description: string;
};

export type Skill = SkillMeta & {
    /** Full markdown content of the skill. */
    content: string;
};

export type SkillInput =
    | Skill
    | (SkillMeta & {
          /** Inline content; if omitted, loader must be provided. */
          content?: string;
          /** Lazy loader to fetch the skill content on-demand. */
          loader?: () => string | Promise<string>;
      });

export type ResolvedSkill = SkillMeta & {
    load: () => Promise<string>;
};

export type NextInput = {
    message: string;
    assets?: File[];
    references?: ConversationReference[];
};

export type Next = (
    input: NextInput,
) => AbortablePromise<AsyncIterable<TurnResult>>;

/**
 * createSession 的返回值：可作为 `next` 函数调用，同时附带会话级能力。
 * `rerunToolCall` 按消息在会话历史中的下标定位某次工具调用并重新执行，
 * 返回其结果（失败时抛出）。对话历史只会追加、下标稳定，故用下标定位即可。
 * 执行逻辑内聚在会话内部，调用方无需关心工具如何分发。
 */
export type Session = Next & {
    rerunToolCall: (messageIndex: number) => Promise<unknown>;
};
