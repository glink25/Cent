import { z } from "zod";
import { createTool } from "./tooling";
import type {
    ConversationReference,
    ReferenceResolver,
    UserMessage,
} from "./type";

export function mergeReferences(references: ConversationReference[]) {
    return [
        ...new Map(
            references.map((ref) => [JSON.stringify([ref.type, ref.id]), ref]),
        ).values(),
    ];
}

export function referenceTool(resolve: ReferenceResolver) {
    return createTool({
        name: "readReferences",
        exposure: { native: true, code: true },
        describe:
            "Read host references attached to user messages. Optionally select a reference type and ID, or page through all references.",
        argSchema: z.object({
            type: z.string().optional(),
            id: z.string().optional(),
            offset: z.number().int().nonnegative().default(0),
            limit: z.number().int().min(1).max(20).default(10),
        }),
        returnSchema: z.unknown(),
        async handler({ type, id, offset, limit }, { history, signal }) {
            const references = mergeReferences(
                history.flatMap((message) =>
                    message.role === "user" ? (message.references ?? []) : [],
                ),
            ).filter(
                (ref) => (!type || ref.type === type) && (!id || ref.id === id),
            );
            const page = references.slice(offset, offset + limit);
            return {
                references: await resolve(page, signal),
                nextOffset:
                    offset + page.length < references.length
                        ? offset + page.length
                        : null,
            };
        },
    });
}

export function formatUserReferences(message: UserMessage): string {
    if (!message.references?.length) return message.raw;
    const refs = message.references.map(({ type, id, label }) => ({
        type,
        id,
        label,
    }));
    return `${message.raw}\nHost references (read with readReferences): ${JSON.stringify(refs)}`;
}
