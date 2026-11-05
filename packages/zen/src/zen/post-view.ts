import type { ZenPost } from "./types";

export type SavedReflection = {
    id: string;
    title?: string;
    text: string[];
    answers: string[];
    snapshots: unknown[];
};
const record = (value: unknown): Record<string, unknown> | undefined =>
    value !== null && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : undefined;
const strings = (value: unknown): string[] => {
    if (typeof value === "string") return [value];
    if (typeof value === "number" || typeof value === "boolean")
        return [String(value)];
    if (Array.isArray(value)) return value.flatMap(strings);
    return [];
};
/** Read-only projection. Never executes legacy component descriptions or rewrites stored posts. */
export function savedReflections(post: ZenPost): SavedReflection[] {
    if (Array.isArray(post.stepRecords) && post.stepRecords.length) {
        return post.stepRecords.flatMap((value, index) => {
            const item = record(value);
            if (!item) return [];
            const step = record(item.step);
            const submission = record(item.submission);
            const values = record(submission?.values);
            const text = [
                item.summary,
                step?.description,
                ...(Array.isArray(step?.content)
                    ? step.content.map((c) => record(c)?.body)
                    : []),
            ].flatMap(strings);
            return [
                {
                    id:
                        typeof item.stepId === "string"
                            ? item.stepId
                            : String(index),
                    title: strings(step?.title)[0],
                    text: [...new Set(text)],
                    answers: values
                        ? Object.entries(values).map(
                              ([key, val]) =>
                                  `${key}: ${strings(val).join(", ")}`,
                          )
                        : [],
                    snapshots: Array.isArray(item.entitySnapshots)
                        ? item.entitySnapshots
                        : [],
                },
            ];
        });
    }
    const legacy = (Array.isArray(post.steps) ? post.steps : []).flatMap(
        (value, index) => {
            const item = record(value);
            if (!item) return [];
            const component = record(item.component);
            const input = record(item.userInput);
            return [
                {
                    id:
                        typeof item.stepId === "string"
                            ? item.stepId
                            : String(index),
                    title: strings(component?.title)[0],
                    text: [
                        component?.body,
                        component?.description,
                        component?.summary,
                    ].flatMap(strings),
                    answers: input
                        ? Object.entries(input).map(
                              ([key, val]) =>
                                  `${key}: ${strings(val).join(", ")}`,
                          )
                        : strings(item.userInput),
                    snapshots: Array.isArray(item.billSnapshots)
                        ? item.billSnapshots
                        : [],
                },
            ];
        },
    );
    return [
        ...legacy,
        ...(Array.isArray(post.cardSummaries)
            ? post.cardSummaries
            : []
        ).flatMap((text, i) =>
            typeof text === "string"
                ? [
                      {
                          id: `summary-${i}`,
                          text: [text],
                          answers: [],
                          snapshots: [],
                      },
                  ]
                : [],
        ),
    ];
}
