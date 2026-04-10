import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { parseWithSchema, stringifyJson } from "./shared";
import systemPromptTemplate from "./system-prompt.md?raw";
import type {
    CreateToolInput,
    History,
    MinimalSchema,
    Tool,
    ToolJsonSchema,
    ToolMessage,
    ToolPromptDefinition,
    ZodLikeSchema,
} from "./type";

const SYSTEM_PROMPT_TOOLS_PLACEHOLDER = "{{TOOLS_JSON}}";

export function isZodSchema(schema: unknown): schema is ZodLikeSchema {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "_def" in schema &&
        "safeParse" in schema &&
        typeof (schema as { safeParse?: unknown }).safeParse === "function"
    );
}

function normalizeJsonSchema(schema: unknown): ToolJsonSchema {
    if (
        typeof schema !== "object" ||
        schema === null ||
        Array.isArray(schema)
    ) {
        return { type: "object", description: String(schema) };
    }
    return schema as ToolJsonSchema;
}

function schemaToPromptJsonSchema(name: string, schema: ZodLikeSchema) {
    return normalizeJsonSchema(
        zodToJsonSchema(
            schema as unknown as Parameters<typeof zodToJsonSchema>[0],
            {
                name,
                $refStrategy: "none",
                target: "jsonSchema7",
            },
        ),
    );
}

function minimalSchemaToPromptJsonSchema(description: string): ToolJsonSchema {
    return {
        type: "object",
        description,
    };
}

function stringifyToolPayload(payload: unknown): string {
    try {
        return JSON.stringify(payload);
    } catch {
        return String(payload);
    }
}

function formatToolSuccess(
    name: string,
    params: unknown,
    returns: unknown,
): ToolMessage {
    return {
        role: "tool",
        raw: stringifyToolPayload({ name, params, returns }),
        formatted: {
            name,
            params,
            returns,
        },
    };
}

function formatToolError(
    name: string,
    params: unknown,
    errors: unknown,
): ToolMessage {
    return {
        role: "tool",
        raw: stringifyToolPayload({ name, params, errors }),
        formatted: {
            name,
            params,
            errors,
        },
    };
}

export function createListToolsTool(
    tools: Tool[],
): Tool<{ names?: string[] }, ToolPromptDefinition[]> {
    const argSchema: MinimalSchema<{ names?: string[] }> = {
        safeParse(value: unknown) {
            if (value === undefined || value === null) {
                return { success: true as const, data: {} };
            }
            if (typeof value !== "object" || Array.isArray(value)) {
                return {
                    success: false as const,
                    error: new Error("listTools params must be an object."),
                };
            }
            const names = (value as { names?: unknown }).names;
            if (
                names !== undefined &&
                (!Array.isArray(names) ||
                    names.some((item) => typeof item !== "string"))
            ) {
                return {
                    success: false as const,
                    error: new Error("listTools names must be a string array."),
                };
            }
            return {
                success: true as const,
                data: value as { names?: string[] },
            };
        },
    };

    const returnSchema: MinimalSchema<ToolPromptDefinition[]> = {
        safeParse(value: unknown) {
            return {
                success: true as const,
                data: value as ToolPromptDefinition[],
            };
        },
    };

    return {
        name: "listTools",
        describe:
            "List available tools and their argument and return schema summary.",
        argSchema,
        returnSchema,
        handler: (input: { names?: string[] }) => {
            const names = input?.names;
            const visibleTools = names?.length
                ? tools.filter((tool) => names.includes(tool.name))
                : tools;
            return visibleTools.map((tool) => tool.toPromptDefinition());
        },
        toPromptDefinition: () => ({
            name: "listTools",
            describe:
                "List available tools and their argument and return schema summary.",
            argSchema: minimalSchemaToPromptJsonSchema(
                "Object with optional names:string[] to fetch a subset of tools.",
            ),
            returnSchema: minimalSchemaToPromptJsonSchema(
                "Array of tool prompt definitions including name, describe, argSchema and returnSchema.",
            ),
        }),
    };
}

function buildToolsPromptBlock(tools: Tool<any, any>[]) {
    const definitions = tools.map((tool) => tool.toPromptDefinition());
    return stringifyJson(definitions);
}

export function mergeSystemPrompt(
    systemPrompt: string | undefined,
    tools: Tool<any, any>[],
) {
    const mergedTemplate = systemPromptTemplate.replace(
        SYSTEM_PROMPT_TOOLS_PLACEHOLDER,
        buildToolsPromptBlock(tools),
    );
    if (!systemPrompt?.trim()) {
        return mergedTemplate.trim();
    }
    return `${mergedTemplate.trim()}\n\nAdditional system prompt:\n${systemPrompt.trim()}`;
}

export function getInitialSystemPrompt(tools: Tool<any, any>[]) {
    const mergedTemplate = systemPromptTemplate.replace(
        SYSTEM_PROMPT_TOOLS_PLACEHOLDER,
        buildToolsPromptBlock(tools),
    );
    return mergedTemplate.trim();
}

export async function executeToolCall(
    toolMap: Map<string, Tool>,
    toolCall: { name: string; params: unknown },
    ctx: { history: History },
): Promise<ToolMessage> {
    const tool = toolMap.get(toolCall.name);
    if (!tool) {
        return formatToolError(toolCall.name, toolCall.params, {
            message: `Tool "${toolCall.name}" not found.`,
        });
    }

    let params: unknown;
    try {
        params = parseWithSchema(tool.argSchema, toolCall.params);
    } catch (error) {
        return formatToolError(tool.name, toolCall.params, error);
    }

    try {
        const returns = await tool.handler(params as never, ctx);
        const normalizedReturns = parseWithSchema(tool.returnSchema, returns);
        return formatToolSuccess(tool.name, params, normalizedReturns);
    } catch (error) {
        return formatToolError(tool.name, params, error);
    }
}

export function createTool<
    ArgsSchema extends ZodLikeSchema,
    ReturnSchema extends ZodLikeSchema,
>(
    input: CreateToolInput<ArgsSchema, ReturnSchema>,
): Tool<z.infer<ArgsSchema>, z.infer<ReturnSchema>> {
    const { name, describe, argSchema, returnSchema, handler } = input;
    if (!isZodSchema(argSchema) || !isZodSchema(returnSchema)) {
        throw new Error(
            "createTool requires zod schemas for argSchema and returnSchema.",
        );
    }
    return {
        name,
        describe,
        argSchema,
        returnSchema,
        handler,
        toPromptDefinition: () => ({
            name,
            describe,
            argSchema: schemaToPromptJsonSchema(`${name}Args`, argSchema),
            returnSchema: schemaToPromptJsonSchema(
                `${name}Returns`,
                returnSchema,
            ),
        }),
    };
}
