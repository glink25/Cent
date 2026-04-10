import type { Tool } from "@/assistant";
import { PlaygroundSkill, PlaygroundTool } from "./playground";
import { CentAIProvider } from "./provider";

export const CentAIConfig = {
    tools: [PlaygroundTool] as Tool[],
    skills: [PlaygroundSkill],
    provider: CentAIProvider,
};
