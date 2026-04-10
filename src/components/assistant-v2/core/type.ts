import type { ZodTypeAny, z } from "zod";

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

export type ZodLikeSchema = ZodTypeAny;

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

export type ToolSchema<T = unknown> = ZodLikeSchema | MinimalSchema<T>;

export type ToolJsonSchema = Record<string, unknown>;

export type ToolPromptDefinition = {
    name: string;
    describe: string;
    argSchema: ToolJsonSchema;
    returnSchema: ToolJsonSchema;
};

export type Tool<Args = unknown, Returns = unknown> = {
    name: string;
    describe: string;
    argSchema: ToolSchema;
    returnSchema: ToolSchema;
    handler: (
        arg: Args,
        ctx: { history: History },
    ) => Returns | Promise<Returns>;
    toPromptDefinition: () => ToolPromptDefinition;
};

export type CreateToolInput<
    ArgsSchema extends ZodLikeSchema,
    ReturnSchema extends ZodLikeSchema,
> = {
    name: string;
    describe: string;
    argSchema: ArgsSchema;
    returnSchema: ReturnSchema;
    handler: (
        arg: z.infer<ArgsSchema>,
    ) => z.infer<ReturnSchema> | Promise<z.infer<ReturnSchema>>;
};

export type NextInput = {
    message: string;
    assets?: File[];
};

export type Next = (
    input: NextInput,
) => AbortablePromise<AsyncIterable<TurnResult>>;
