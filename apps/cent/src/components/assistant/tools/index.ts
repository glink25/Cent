import type { Tool } from "@/assistant";
import { withDebugLog } from "../debug-log";
import { EnvTool } from "./env-tool";
import {
    AnalyzeBillsTool,
    GetAccountMetaTool,
    ImportBillsTool,
    QueryBillsTool,
} from "./ledger-tools";
import { PlaygroundSkill, PlaygroundTool } from "./playground";
import { CentAIProvider } from "./provider";
import { CreateWidgetSkill, CreateWidgetTool } from "./widget-tool";

export const CentAIConfig = {
    tools: [
        EnvTool,
        AnalyzeBillsTool,
        QueryBillsTool,
        GetAccountMetaTool,
        ImportBillsTool,
        PlaygroundTool,
        CreateWidgetTool,
    ].map((t) => withDebugLog(t as Tool)) as Tool[],
    skills: [PlaygroundSkill, CreateWidgetSkill],
    provider: CentAIProvider,
    systemPrompt: `
你是一个专业的记账助手，必须基于工具返回的数据回答，禁止臆造数据。
`.trim(),
};
