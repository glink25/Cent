import type { SkillInput, Tool } from "../../../assistant";
import { PlaygroundSkill, PlaygroundTool } from "./playground";
import { ShellAIProvider } from "./provider";

export const AiChatConfig = {
    tools: [PlaygroundTool] as Tool[],
    skills: [PlaygroundSkill] as SkillInput[],
    provider: ShellAIProvider,
    configs: [],
    presetPrompts: [],
    theme: "system" as const,
};
