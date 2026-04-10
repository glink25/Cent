import { z } from "zod";
import { createTool, type History } from "@/assistant";
import createSandBox, { API, type API as SandboxAPI } from "@/utils/sandbox";

type PlaygroundFile = {
    index: number;
    name: string;
    type: string;
    size: number;
    lastModified: number;
    text: string;
};

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

async function collectSessionFiles(history: History) {
    const files = history.flatMap((msg) =>
        msg.role === "user" && msg.assets?.length ? msg.assets : [],
    );
    const payload: PlaygroundFile[] = [];
    for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        payload.push({
            index: i + 1,
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified,
            text: await file.text(),
        });
    }
    return payload;
}

function buildInjectedGetFile(files: PlaygroundFile[]) {
    return `
const __PLAYGROUND_FILES__ = ${JSON.stringify(files)};
globalThis.getFile = function(index) {
  if (!Number.isInteger(index) || index <= 0) return null;
  return __PLAYGROUND_FILES__.find((file) => file.index === index) ?? null;
};
`;
}

const defaultWhiteList = Object.keys(API) as SandboxAPI[];

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
        timeoutMs: z
            .number()
            .int()
            .positive()
            .max(30000)
            .optional()
            .describe("Execution timeout in milliseconds. Default: 2000."),
        whiteList: z
            .array(z.enum(Object.keys(API) as [SandboxAPI, ...SandboxAPI[]]))
            .optional()
            .describe("Allowed JS globals in sandbox worker."),
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
            whiteList?: SandboxAPI[];
        },
        ctx: { history: History },
    ) => {
        const { history } = ctx;
        const files = await collectSessionFiles(history);
        const inject = buildInjectedGetFile(files);
        const sandbox = createSandBox(arg.whiteList ?? defaultWhiteList);

        try {
            const result = await sandbox.runDefaultExport(
                `${inject}\n${arg.code}`,
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
