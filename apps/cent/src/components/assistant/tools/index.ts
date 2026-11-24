import { CentAgentConfig } from "@/agent/runtime";
import type { Tool } from "@/assistant";
import { browserFetchTool } from "./fetch";
import { CentAIProvider } from "./provider";

export const CentAIConfig = {
    ...CentAgentConfig,
    provider: CentAIProvider,
    tools: [...CentAgentConfig.tools, browserFetchTool as Tool],
};
