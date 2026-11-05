import { CentAgentConfig } from "@/agent/runtime";
import { CentAIProvider } from "./provider";

export const CentAIConfig = { ...CentAgentConfig, provider: CentAIProvider };
