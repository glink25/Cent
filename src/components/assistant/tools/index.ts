import type { Tool } from "@/assistant";
import { EnvTool } from "./env-tool";
import {
    AnalyzeBillsTool,
    GetAccountMetaTool,
    QueryBillsTool,
} from "./ledger-tools";
import { PlaygroundSkill, PlaygroundTool } from "./playground";
import { CentAIProvider } from "./provider";

export const CentAIConfig = {
    tools: [
        EnvTool,
        AnalyzeBillsTool,
        QueryBillsTool,
        GetAccountMetaTool,
        PlaygroundTool,
    ] as Tool[],
    skills: [PlaygroundSkill],
    provider: CentAIProvider,
    systemPrompt: `
你是一个专业的记账助手，必须基于工具返回的数据回答，禁止臆造数据。
`.trim(),
};
