import { z } from "zod";
import { createTool, type History } from "@/assistant";
import createSandBox from "@/utils/sandbox";

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
        "Execute JavaScript module code in a sandboxed worker. Supports getFile(index) for uploaded files in this conversation.",
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
        ctx: { history: History },
    ) => {
        const { history } = ctx;
        const transferable = await collectSessionFiles(history);
        const sandbox = createSandBox([], undefined, transferable);

        try {
            const result = await sandbox.runDefaultExport(
                `const getFile = (index) => globalThis.__FROM_TRANSFER__.find(f => f.index === index)?.file;\n${arg.code}`,
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
