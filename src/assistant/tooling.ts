import type { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { parseWithSchema, stringifyJson } from "./shared";
import systemPromptTemplate from "./system-prompt.md?raw";
import type {
    CreateToolInput,
    History,
    MinimalSchema,
    ResolvedSkill,
    SkillMeta,
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
    tools: Tool<any, any>[],
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

export function createListSkillsTool(
    skills: Array<Pick<ResolvedSkill, "id" | "name" | "description">>,
): Tool<{ ids?: string[] }, SkillMeta[]> {
    const argSchema: MinimalSchema<{ ids?: string[] }> = {
        safeParse(value: unknown) {
            if (value === undefined || value === null) {
                return { success: true as const, data: {} };
            }
            if (typeof value !== "object" || Array.isArray(value)) {
                return {
                    success: false as const,
                    error: new Error("listSkills params must be an object."),
                };
            }
            const ids = (value as { ids?: unknown }).ids;
            if (
                ids !== undefined &&
                (!Array.isArray(ids) ||
                    ids.some((item) => typeof item !== "string"))
            ) {
                return {
                    success: false as const,
                    error: new Error("listSkills ids must be a string array."),
                };
            }
            return {
                success: true as const,
                data: value as { ids?: string[] },
            };
        },
    };

    const returnSchema: MinimalSchema<SkillMeta[]> = {
        safeParse(value: unknown) {
            return { success: true as const, data: value as SkillMeta[] };
        },
    };

    return {
        name: "listSkills",
        describe:
            "List available skills (metadata only). Use loadSkill to read full content.",
        argSchema,
        returnSchema,
        handler: (input: { ids?: string[] }) => {
            const ids = input?.ids;
            const visible = ids?.length
                ? skills.filter((s) => ids.includes(s.id))
                : skills;
            return visible.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
            }));
        },
        toPromptDefinition: () => ({
            name: "listSkills",
            describe:
                "List available skills (metadata only). Use loadSkill to read full content.",
            argSchema: minimalSchemaToPromptJsonSchema(
                "Object with optional ids:string[] to fetch a subset of skills.",
            ),
            returnSchema: minimalSchemaToPromptJsonSchema(
                "Array of skill metadata including id, name, description.",
            ),
        }),
    };
}

export function createLoadSkillTool(
    skillMap: Map<string, ResolvedSkill>,
): Tool<
    { id: string },
    { id: string; name: string; description: string; content: string }
> {
    const argSchema: MinimalSchema<{ id: string }> = {
        safeParse(value: unknown) {
            if (
                typeof value !== "object" ||
                value === null ||
                Array.isArray(value)
            ) {
                return {
                    success: false as const,
                    error: new Error("loadSkill params must be an object."),
                };
            }
            const id = (value as { id?: unknown }).id;
            if (typeof id !== "string" || !id.trim()) {
                return {
                    success: false as const,
                    error: new Error(
                        "loadSkill id must be a non-empty string.",
                    ),
                };
            }
            return { success: true as const, data: { id } };
        },
    };

    const returnSchema: MinimalSchema<{
        id: string;
        name: string;
        description: string;
        content: string;
    }> = {
        safeParse(value: unknown) {
            return {
                success: true as const,
                data: value as {
                    id: string;
                    name: string;
                    description: string;
                    content: string;
                },
            };
        },
    };

    return {
        name: "loadSkill",
        describe: "Load a skill full markdown content by id.",
        argSchema,
        returnSchema,
        handler: async ({ id }: { id: string }) => {
            const skill = skillMap.get(id);
            if (!skill) {
                throw new Error(`Skill "${id}" not found.`);
            }
            const content = await skill.load();
            return {
                id: skill.id,
                name: skill.name,
                description: skill.description,
                content,
            };
        },
        toPromptDefinition: () => ({
            name: "loadSkill",
            describe: "Load a skill full markdown content by id.",
            argSchema: minimalSchemaToPromptJsonSchema(
                "Object with required id:string (from listSkills result).",
            ),
            returnSchema: minimalSchemaToPromptJsonSchema(
                "Skill payload including id, name, description, content(markdown).",
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
