import { CentAIConfig } from "@/components/assistant/tools";
import { buildSkillMarkdown, buildToolList, type SkillContext } from "./skill";

/**
 * Platform-agnostic core dispatch for the agent-api feature.
 *
 * These helpers expose the same tools/skills the built-in assistant uses
 * (`CentAIConfig`) to external AI agents. They know nothing about the
 * transport (local HTTP server, Web MCP, …) — that lives in the adapters.
 */

export type { SkillContext } from "./skill";

/** Machine-readable list of available tools and skills (with JSON Schema). */
export function getToolList() {
    return buildToolList(CentAIConfig.tools, CentAIConfig.skills as never);
}

/** Human-readable skill manual describing how to use the exposed tools. */
export function getSkillMarkdown(ctx: SkillContext): string {
    return buildSkillMarkdown(
        CentAIConfig.tools,
        ctx,
        CentAIConfig.skills as never,
    );
}

/**
 * Validate args against the tool's schema and invoke its handler.
 * Throws on unknown tool name or invalid arguments.
 */
export async function callTool(name: string, args: unknown): Promise<unknown> {
    const tool = CentAIConfig.tools.find((t) => t.name === name);
    if (!tool) {
        throw new Error(`Tool not found: ${name}`);
    }
    let parsed: unknown = args;
    if (tool.argSchema) {
        const r = tool.argSchema.safeParse(args ?? {});
        if (!r.success) {
            throw new Error(`Invalid args: ${JSON.stringify(r.error)}`);
        }
        parsed = r.data;
    }
    const out = await tool.handler(parsed as never, {
        history: [],
        tools: CentAIConfig.tools,
    });
    return out ?? null;
}
