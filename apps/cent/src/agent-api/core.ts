import { z } from "zod";
import { CentAgentConfig } from "@/agent/runtime";
import { createTool, executeToolCall, type Tool } from "@/assistant";
import { buildSkillMarkdown, buildToolList, type SkillContext } from "./skill";

export type { SkillContext } from "./skill";

const readDocs = createTool({
    name: "readDocs",
    exposure: { native: true, code: true },
    describe:
        "Read Cent operation documentation. Omit id to list available manuals; widget documents the interactive v2 API.",
    argSchema: z.object({ id: z.string().optional() }),
    returnSchema: z.unknown(),
    handler: ({ id }) => {
        if (!id)
            return CentAgentConfig.skills.map(({ id, name, description }) => ({
                id,
                name,
                description,
            }));
        const skill = CentAgentConfig.skills.find((s) => s.id === id);
        if (!skill) throw new Error("Unknown document");
        return skill;
    },
});
const tools = [...CentAgentConfig.tools, readDocs] as Tool[];
export function getToolList() {
    return buildToolList(
        tools.filter((t) => t.exposure?.native),
        CentAgentConfig.skills,
    );
}
export function getSkillMarkdown(ctx: SkillContext): string {
    return buildSkillMarkdown(
        tools.filter((t) => t.exposure?.native),
        ctx,
        CentAgentConfig.skills,
    );
}
export async function callTool(
    name: string,
    args: unknown,
    signal?: AbortSignal,
): Promise<unknown> {
    const result = await executeToolCall(
        new Map(tools.map((t) => [t.name, t])),
        { name, params: args },
        {
            history: [],
            tools,
            signal,
            surface: "native",
            source: "webmcp",
        },
    );
    if (result.formatted.errors !== undefined)
        throw new Error(JSON.stringify(result.formatted.errors));
    return result.formatted.returns ?? null;
}
