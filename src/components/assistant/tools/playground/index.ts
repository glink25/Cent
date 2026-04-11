import type { Skill } from "@/assistant";
import { parseSkillMetadata } from "@/assistant/parser";
import playgroundSkill from "./skill.md?raw";

export { PlaygroundTool } from "./tool";
export const PlaygroundSkill: Skill = parseSkillMetadata(playgroundSkill);
