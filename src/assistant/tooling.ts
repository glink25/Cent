import { z } from "zod";
import { parseWithSchema, stringifyJson } from "./shared";
import systemPromptTemplate from "./system-prompt.md?raw";
import type {
    CreateToolInput,
    History,
    ResolvedSkill,
    SkillMeta,
    Tool,
    ToolMessage,
    ToolPromptDefinition,
    ZodLikeSchema,
} from "./type";

const SYSTEM_PROMPT_TOOLS_PLACEHOLDER = "{{TOOLS_JSON}}";
const jsonObjectSchema = z.record(z.string(), z.unknown());

const toolPromptDefinitionSchema = z.object({
    name: z.string(),
    describe: z.string(),
    argSchema: jsonObjectSchema.optional(),
    returnSchema: jsonObjectSchema,
});

const listToolsReturnsSchema = z
    .array(toolPromptDefinitionSchema)
    .describe(
        "Array of tool prompt definitions including name, describe, argSchema and returnSchema.",
    );

const skillMetaSchema = z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
});
const listSkillsReturnsSchema = z
    .array(skillMetaSchema)
    .describe("Array of skill metadata including id, name, description.");

const loadSkillArgsSchema = z
    .object({
        id: z.string().trim().min(1),
    })
    .describe("Object with required id:string (from listSkills result).");

const loadSkillReturnsSchema = z
    .object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        content: z.string(),
    })
    .describe(
        "Skill payload including id, name, description, content(markdown).",
    );

export function isZodSchema(schema: unknown): schema is ZodLikeSchema {
    return (
        typeof schema === "object" &&
        schema !== null &&
        "_def" in schema &&
        "safeParse" in schema &&
        typeof (schema as { safeParse?: unknown }).safeParse === "function"
    );
}

function toolToPromptDefinition(tool: Tool): ToolPromptDefinition {
    const cuttedToJSONSchema = (v: ZodLikeSchema) => {
        const schema = z.toJSONSchema(v);
        return {
            ...schema,
            $schema: undefined, // 去掉 $schema 字段，减少冗余信息
        };
    };
    return {
        name: tool.name,
        describe: tool.describe,
        argSchema: tool.argSchema
            ? cuttedToJSONSchema(tool.argSchema)
            : undefined,
        returnSchema: cuttedToJSONSchema(tool.returnSchema),
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
): Tool<undefined, ToolPromptDefinition[]> {
    return createTool({
        name: "listTools",
        describe:
            "List available tools and their argument and return schema summary.",
        argSchema: undefined,
        returnSchema: listToolsReturnsSchema,
        handler: () => {
            return tools.map(toolToPromptDefinition);
        },
    });
}

export function createListSkillsTool(
    skills: Array<Pick<ResolvedSkill, "id" | "name" | "description">>,
): Tool<undefined, SkillMeta[]> {
    return createTool({
        name: "listSkills",
        describe:
            "List available skills (metadata only). Use loadSkill to read full content.",
        argSchema: undefined,
        returnSchema: listSkillsReturnsSchema,
        handler: () => {
            return skills.map((s) => ({
                id: s.id,
                name: s.name,
                description: s.description,
            }));
        },
    });
}

export function createLoadSkillTool(
    skillMap: Map<string, ResolvedSkill>,
): Tool<
    { id: string },
    { id: string; name: string; description: string; content: string }
> {
    return createTool({
        name: "loadSkill",
        describe: "Load a skill full markdown content by id.",
        argSchema: loadSkillArgsSchema,
        returnSchema: loadSkillReturnsSchema,
        handler: async ({ id }) => {
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
    });
}

function buildToolsPromptBlock(tools: Tool[]) {
    const definitions = tools.map(toolToPromptDefinition);
    return stringifyJson(definitions);
}

export function mergeSystemPrompt(
    systemPrompt: string | undefined,
    tools: Tool[],
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
    if (!isZodSchema(returnSchema)) {
        throw new Error("createTool requires zod schemas for returnSchema.");
    }
    return {
        name,
        describe,
        argSchema,
        returnSchema,
        handler: handler as any,
    };
}
