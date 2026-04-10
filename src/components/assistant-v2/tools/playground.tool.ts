import type { Tool } from "../core";

const simpleSchema = {
    safeParse: (value: unknown) => ({ success: true, data: value }) as const,
};

export const PlaygroundTool: Tool = {
    name: "playground",
    describe: "Sandbox tool for executing arbitrary code (TODO)",
    argSchema: simpleSchema,
    returnSchema: simpleSchema,
    handler: async () => {
        throw new Error("PlaygroundTool is not implemented yet");
    },
    toPromptDefinition: () => ({
        name: "playground",
        describe: "Sandbox tool for executing arbitrary code (TODO)",
        argSchema: {},
        returnSchema: {},
    }),
};
