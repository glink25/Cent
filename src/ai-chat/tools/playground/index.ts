import type { Skill } from "../../core";
import { parseSkillMetadata } from "../../core/parser";
import playgroundSkill from "./skill.md?raw";

export { PlaygroundTool } from "./tool";
export const PlaygroundSkill: Skill = parseSkillMetadata(playgroundSkill);
