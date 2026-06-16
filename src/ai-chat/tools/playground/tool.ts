import { z } from "zod";
import createSandBox from "@/utils/sandbox";
import { createTool, type History, type ToolContext } from "../../core";
import { parseWithSchema } from "../../core/shared";

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

export const PlaygroundTool = createTool({
    name: "playground",
    describe:
        "Execute JavaScript module code in a sandboxed worker. Supports getFile(index) for uploaded files in this conversation. " +
        "Also exposes an async `tools` object: call any other available tool as a function, e.g. `await tools.importBills({ items, meta })`. " +
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
        const transferable = await collectSessionFiles(history);

        // 宿主侧的工具调用：根据名称在本会话的工具列表中查找并执行其 handler，
        // 复用与普通工具调用一致的 schema 校验。这些调用不会写入对话历史，
        // 视为 playground 调用的内部行为（与 getFile 一样），避免污染上下文。
        const callHost = async (name: string, params: unknown) => {
            if (name === "playground") {
                throw new Error("playground cannot call itself.");
            }
            const tool = tools.find((t) => t.name === name);
            if (!tool) {
                throw new Error(`Tool "${name}" not found.`);
            }
            const parsed = parseWithSchema(tool.argSchema, params);
            const returns = await tool.handler(parsed as never, ctx);
            return parseWithSchema(tool.returnSchema, returns);
        };

        // 根据本会话注册的工具动态生成 `tools` 对象（排除 playground 自身），
        // 每个键经 RPC 桥接路由到宿主侧的 callHost。新增工具无需改动此处。
        const toolNames = tools
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

        const sandbox = createSandBox([], undefined, transferable, callHost);

        try {
            const result = await sandbox.runDefaultExport(
                `${prelude}${arg.code}`,
                arg.args ?? [],
                arg.timeoutMs ?? 2000,
            );
            return {
                success: true,
                result,
            };
        } catch (error) {
            return {
                success: false,
                error: toErrorMessage(error),
            };
        } finally {
            sandbox.destroy();
        }
    }) as never,
});

// Promise.resolve(
//     PlaygroundTool.handler(
//         {
//             code: "export default function() { const file = getFile(1);return file.name; }",
//         },
//         {
//             history: [
//                 { role: "user", assets: [new File([], "test.txt")], raw: "" },
//             ],
//         },
//     ),
// ).then(console.log);
