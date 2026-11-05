import { z } from "zod";
import { createTool, parseSkillMetadata, type Tool } from "@/assistant";
import { withDebugLog } from "@/components/assistant/debug-log";
import { EnvTool } from "@/components/assistant/tools/env-tool";
import {
    PlaygroundSkill,
    PlaygroundTool,
} from "@/components/assistant/tools/playground";
import { CreateWidgetSkill } from "@/components/assistant/tools/widget-tool";
import principles from "./cent-principles.md?raw";
import { guardOperation } from "./guard";
import { mutationTools } from "./mutation-tools";
import { createDataOperations } from "./operations";
import { withToolDisplay } from "./tool-display";
import { readAgentSnapshot } from "./web-host";
import { widgetOperations } from "./widget-operations";

const operations: Tool[] = [
    ...createDataOperations({ snapshot: readAgentSnapshot }),
    ...widgetOperations,
    EnvTool,
].map((t) =>
    withDebugLog(
        guardOperation({
            ...t,
            exposure: { code: true, native: false },
        } as Tool),
    ),
);

const discover = createTool({
    name: "discover",
    exposure: { code: true, native: true },
    describe:
        "Discover Cent operations callable via playground tools.NAME(args). Returns schemas and exact data units. Read widget skill before generating code.",
    argSchema: z.object({}),
    returnSchema: z.array(z.unknown()),
    handler: () =>
        [
            ...operations,
            ...mutationTools.filter((tool) => tool.exposure?.code),
        ].map((tool) => ({
            name: tool.name,
            description: tool.describe,
            input: tool.argSchema ? z.toJSONSchema(tool.argSchema) : {},
            output: z.toJSONSchema(tool.returnSchema),
        })),
});

export const CentAgentConfig = {
    tools: (
        [...operations, ...mutationTools, discover, PlaygroundTool] as Tool[]
    ).map(withToolDisplay),
    skills: [
        parseSkillMetadata(principles),
        PlaygroundSkill,
        CreateWidgetSkill,
    ],
    systemPrompt: `
你是一个专业的记账助手，必须基于工具返回的数据回答，禁止臆造数据。设计报销、账户、转账等扩展前，读取 cent-principles 和 widget skill。
工具输出可能因过长返回 OUTPUT_LIMIT，或携带 truncated/hasMore 标记；这不表示完整数据。优先在代码里筛选、聚合，只返回摘要；需要明细时分页查询，不能将截断结果当作全量。
当用户指代当前页面的内容，先用 getEnv 读取实时条件。单项修改可用原生写入工具；多项修改可在 playground 内逐项 await 写入工具，脚本成功后整批确认。staged 不是已写入，查看 change 回执或 getChangeStatus。
模型生成过长的工具参数也可能中断。收到可恢复协议错误时，缩短单次代码、拆分任务并修正参数；错误提示未执行的批次可重试，之前成功的写操作不能重复提交。
`.trim(),
};
