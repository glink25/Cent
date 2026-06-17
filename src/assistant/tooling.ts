import { z } from "zod";
import { parseWithSchema } from "./shared";
import systemPromptTemplate from "./system-prompt.md?raw";
import type {
    CreateToolInput,
    ResolvedSkill,
    SkillMeta,
    Tool,
    ToolContext,
    ToolMessage,
    ZodLikeSchema,
} from "./type";

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

// 工具现在通过 API 原生 tools 字段下发，system prompt 不再注入工具文本描述。
export function getInitialSystemPrompt() {
    return systemPromptTemplate.trim();
}

export async function executeToolCall(
    toolMap: Map<string, Tool>,
    toolCall: { name: string; params: unknown },
    ctx: ToolContext,
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
