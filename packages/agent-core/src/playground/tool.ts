import { z } from "zod";
import {
    createTool,
    type History,
    type Tool,
    type ToolContext,
} from "../assistant";
import { parseWithSchema } from "../assistant/shared";
import createSandBox from "./sandbox";

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function collectSessionFiles(
    history: History,
): Promise<Array<{ index: number; file: File }>> {
    const files = history.flatMap((msg) =>
        msg.role === "user" && msg.assets?.length ? msg.assets : [],
    );
    return files.map((file, i) => ({ index: i + 1, file }));
}

export function createPlaygroundTool(
    begin?: (context: ToolContext) => {
        finish(context: ToolContext): Promise<unknown>;
        dispose(): void;
    },
): Tool {
    return createTool({
        name: "playground",
        exposure: { native: true, code: false },
        effect: "write",
        describe:
            "Execute JavaScript module code in a sandboxed worker. Supports getFile(index) for uploaded files in this conversation. " +
            "Also exposes an async `tools` object: call any other available tool as a function, e.g. `await tools.listSkills({})`. " +
            "Use this to compute data and invoke a tool with it in one snippet, instead of emitting the payload as a separate tool call.",
        argSchema: z.object({
            code: z
                .string()
                .min(1)
                .describe(
                    "JavaScript module source code. Must export default function.",
                ),
            args: z
                .array(z.unknown())
                .optional()
                .describe("Arguments passed to the default-exported function."),
        }),
        returnSchema: z.object({
            success: z.boolean(),
            result: z.unknown().optional(),
            error: z.string().optional(),
            change: z.unknown().optional(),
        }),
        handler: (async (
            arg: {
                code: string;
                args?: unknown[];
                timeoutMs?: number;
            },
            ctx: ToolContext,
        ) => {
            const { history, tools } = ctx;
            const allowWrites =
                Boolean(begin) ||
                ctx.resources?.get("cent:native-batch-write") === true;
            const executionContext = {
                ...ctx,
                resources: begin
                    ? (ctx.resources ?? new Map<string, unknown>())
                    : new Map(ctx.resources),
                surface: "code" as const,
            };
            const transferable = await collectSessionFiles(history);

            // 宿主侧的工具调用：根据名称在本会话的工具列表中查找并执行其 handler，
            // 复用与普通工具调用一致的 schema 校验。这些调用不会写入对话历史，
            // 视为 playground 调用的内部行为（与 getFile 一样），避免污染上下文。
            const callHost = async (name: string, params: unknown) => {
                if (name === "playground") {
                    throw new Error("playground cannot call itself.");
                }
                const tool = tools.find((t) => t.name === name);
                ctx.signal?.throwIfAborted();
                if (
                    !tool?.exposure?.code ||
                    (!allowWrites && tool.effect === "write")
                ) {
                    throw new Error(`Tool "${name}" not found.`);
                }
                const parsed = parseWithSchema(tool.argSchema, params);
                const returns = await tool.handler(
                    parsed as never,
                    executionContext,
                );
                ctx.signal?.throwIfAborted();
                return parseWithSchema(tool.returnSchema, returns);
            };

            // 根据本会话注册的工具动态生成 `tools` 对象（排除 playground 自身），
            // 每个键经 RPC 桥接路由到宿主侧的 callHost。新增工具无需改动此处。
            const toolNames = tools
                .filter(
                    (tool) =>
                        tool.exposure?.code &&
                        (allowWrites || tool.effect !== "write"),
                )
                .map((t) => t.name)
                .filter((name) => name !== "playground");
            const toolsPrelude = toolNames
                .map(
                    (name) =>
                        `tools[${JSON.stringify(name)}] = (params) => globalThis.__CALL_HOST__(${JSON.stringify(name)}, params);`,
                )
                .join("\n");
            const prelude =
                `const getFile = (index) => globalThis.__FROM_TRANSFER__.find(f => f.index === index)?.file;\n` +
                `const tools = {};\n${toolsPrelude}\n`;

            const sandbox = createSandBox(
                [],
                undefined,
                transferable,
                callHost,
            );

            const batch = begin?.(executionContext);
            try {
                const result = await sandbox.runDefaultExport(
                    `${prelude}${arg.code}`,
                    arg.args ?? [],
                    arg.timeoutMs ?? 10000,
                    ctx.signal,
                );
                return {
                    success: true,
                    result,
                    ...(batch ? { change: await batch.finish(ctx) } : {}),
                };
            } catch (error) {
                return {
                    success: false,
                    error: toErrorMessage(error),
                };
            } finally {
                sandbox.destroy();
                batch?.dispose();
            }
        }) as never,
    }) as Tool;
}

export const PlaygroundTool = createPlaygroundTool();
