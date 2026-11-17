import { z } from "zod";

export const deleteBillsInput = z.object({
    action: z.literal("delete"),
    ids: z.array(z.string().min(1)).min(1).max(100),
});
