import { z } from "zod";

export type PlaygroundFiles = Readonly<Record<string, string>>;

const fileLimit = 5 * 1024 * 1024;
const directoryLimit = 10 * 1024 * 1024;
const fileCountLimit = 64;
const encoder = new TextEncoder();
const bytes = (text: string) => encoder.encode(text).byteLength;
const path = z
    .string()
    .max(240)
    .refine((value) =>
        value
            .split("/")
            .every(
                (part) =>
                    /^[a-zA-Z0-9_.-]+$/.test(part) &&
                    part !== "." &&
                    part !== ".." &&
                    !Object.hasOwn(Object.prototype, part),
            ),
    );
const text = z.string().max(fileLimit);
const range = z
    .object({
        start: z.number().int().nonnegative(),
        end: z.number().int().nonnegative().optional(),
    })
    .refine(({ start, end }) => end === undefined || end >= start);
const fileCall = z.discriminatedUnion("method", [
    z.object({ method: z.literal("list") }),
    z.object({ method: z.literal("read"), path, range: range.optional() }),
    z.object({ method: z.literal("write"), path, text }),
    z.object({
        method: z.literal("replace"),
        path,
        oldText: text.min(1),
        newText: text,
    }),
    z.object({ method: z.literal("remove"), path }),
]);

/** Supplied by the conversation owner. Updates apply to its current snapshot. */
export type PlaygroundFileStore = {
    read(): PlaygroundFiles;
    update(apply: (files: PlaygroundFiles) => PlaygroundFiles): void;
};

export function callPlaygroundFiles(
    store: PlaygroundFileStore,
    input: unknown,
) {
    const call = fileCall.parse(input);
    if (call.method === "list") {
        return Object.entries(store.read())
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([path, value]) => ({ path, bytes: bytes(value) }));
    }
    if (call.method === "read") {
        const value = store.read()[call.path];
        if (value === undefined) throw new Error("File not found");
        return value.slice(call.range?.start, call.range?.end);
    }
    store.update((files) => {
        const previous = files[call.path];
        if (call.method === "remove") {
            if (previous === undefined) throw new Error("File not found");
            const next = { ...files };
            delete next[call.path];
            return next;
        }

        let value: string;
        if (call.method === "write") {
            value = call.text;
        } else {
            if (previous === undefined) throw new Error("File not found");
            const at = previous.indexOf(call.oldText);
            if (at < 0 || previous.indexOf(call.oldText, at + 1) >= 0)
                throw new Error("Replacement must match exactly once");
            value =
                previous.slice(0, at) +
                call.newText +
                previous.slice(at + call.oldText.length);
        }
        if (value === previous) return files;
        if (bytes(value) > fileLimit)
            throw new Error("File size limit exceeded");
        const next = { ...files, [call.path]: value };
        const values = Object.values(next);
        if (
            values.length > fileCountLimit ||
            values.reduce((total, item) => total + bytes(item), 0) >
                directoryLimit
        )
            throw new Error("Conversation file limit exceeded");
        return next;
    });
    return { path: call.path };
}
