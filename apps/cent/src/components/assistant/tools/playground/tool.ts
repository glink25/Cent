import { createPlaygroundTool } from "@glink25/agent-core/playground";
import { createChangeBatch } from "@/agent/changes";

export const PlaygroundTool = createPlaygroundTool(createChangeBatch);
