import type { ZodType, z } from "zod";

export type UserMessage = {
    role: "user";
    raw: string;
    assets?: File[];
};

export type AssistantMessage = {
    role: "assistant";
    raw: string;
    formatted: {
        thought?: string;
        answer?: string;
        overview?: string;
        tools?: { name: string; params: unknown }[];
    };
};

export type ToolMessage = {
    role: "tool";
    raw: string;
    formatted: {
        name: string;
        params: unknown;
        returns?: unknown;
        errors?: unknown;
        runningTime?: number;
    };
};

export type SystemMessage = {
    role: "system";
    raw: string;
};

export type Message =
    | UserMessage
    | AssistantMessage
    | ToolMessage
    | SystemMessage;
export type History = Message[];

export type AbortablePromise<T = unknown> = Promise<T> & {
    abort: () => void;
};

export type ProviderRequest = {
    history: History;
};

export type ProviderRequestChunk = { thought?: string; answer: string };

export type Provider = {
    request: (
        params: ProviderRequest,
    ) => AbortablePromise<AsyncIterable<ProviderRequestChunk>>;
};

export type TurnResult = {
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

export type Tool<Args = unknown, Returns = unknown> = {
    name: string;
    describe: string;
    argSchema?: ToolSchema;
    returnSchema: ToolSchema;
    handler: (
        arg: Args | undefined,
        ctx: { history: History },
    ) => Returns | Promise<Returns>;
};

export type CreateToolInput<
    ArgsSchema extends ZodLikeSchema | undefined,
    ReturnSchema extends ZodLikeSchema,
> = {
    name: string;
    describe: string;
    argSchema?: ArgsSchema;
    returnSchema: ReturnSchema;
    handler: (
        arg: ArgsSchema extends undefined ? undefined : z.infer<ArgsSchema>,
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
};

export type Next = (
    input: NextInput,
) => AbortablePromise<AsyncIterable<TurnResult>>;
