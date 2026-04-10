import { z } from "zod";
import { createTool } from "@/assistant";
import { getEnvPrompt } from "../env";

export const EnvTool = createTool({
    name: "get_env",
    describe: "获取当前环境信息，包括当前日期、当前账单数据的过滤视图等",
    argSchema: undefined,
    returnSchema: z.string().describe("环境信息的字符串表示"),
    handler() {
        const envInfo = getEnvPrompt();
        return envInfo;
    },
});
