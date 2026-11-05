import { z } from "zod";
import { createTool } from "@/assistant";
import { getEnvPrompt, getPageEnv } from "../env";

export const EnvTool = createTool({
    name: "getEnv",
    describe:
        "获取当前环境信息，包括当前日期、当前账单数据的过滤视图等，当用户提出获取“当前账单”，或者“当前时间”相关的问题时，应该首先调用这个工具来获取最新的环境信息，辅助回答用户的问题。",
    argSchema: undefined,
    returnSchema: z.object({
        page: z.string().optional(),
        context: z.unknown(),
        ledger: z.string(),
    }),
    handler() {
        return { ...getPageEnv(), ledger: getEnvPrompt() };
    },
});
