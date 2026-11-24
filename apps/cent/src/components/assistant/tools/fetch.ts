import { z } from "zod";
import { createTool } from "@/assistant";
import { originalFetch } from "@/utils/fetch-proxy";

const maxBytes = 256 * 1024;
const contentTypes = [
    "text/plain",
    "application/x-www-form-urlencoded",
] as const;

export const browserFetchTool = createTool({
    name: "fetch",
    label: "Fetch",
    describe:
        "Request a public HTTPS resource without credentials. Cross-origin responses are opaque. POST accepts plain text or form-encoded text.",
    effect: "write",
    exposure: { native: true, code: false },
    argSchema: z.strictObject({
        url: z.url().max(4096),
        method: z.enum(["GET", "HEAD", "POST"]).default("GET"),
        contentType: z.enum(contentTypes).optional(),
        body: z.string().optional(),
    }),
    returnSchema: z.discriminatedUnion("type", [
        z.object({ type: z.literal("opaque") }),
        z.object({
            type: z.literal("http"),
            status: z.number(),
            body: z.string(),
        }),
    ]),
    handler: async ({ url, method, body, contentType }, { signal }) => {
        const target = new URL(url);
        if (
            target.protocol !== "https:" ||
            target.username ||
            target.password
        ) {
            throw new Error("Fetch requires an HTTPS URL without credentials.");
        }
        if (
            method !== "POST" &&
            (body !== undefined || contentType !== undefined)
        ) {
            throw new Error("Only POST accepts body and contentType.");
        }
        if (new TextEncoder().encode(body ?? "").length > maxBytes) {
            throw new Error("Request body exceeds 256 KiB.");
        }
        const timeout = AbortSignal.timeout(15_000);
        const response = await originalFetch(target, {
            method,
            body: method === "POST" ? (body ?? "") : undefined,
            headers:
                method === "POST"
                    ? { "Content-Type": contentType ?? "text/plain" }
                    : undefined,
            mode: "no-cors",
            credentials: "omit",
            redirect: "error",
            referrerPolicy: "no-referrer",
            cache: "no-store",
            signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
        });
        if (response.type === "opaque") return { type: "opaque" } as const;
        const reader = response.body?.getReader();
        const decoder = new TextDecoder();
        let size = 0;
        let text = "";
        if (reader) {
            try {
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    size += value.byteLength;
                    if (size > maxBytes)
                        throw new Error("Response body exceeds 256 KiB.");
                    text += decoder.decode(value, { stream: true });
                }
            } finally {
                await reader.cancel().catch(() => undefined);
                reader.releaseLock();
            }
        }
        return {
            type: "http",
            status: response.status,
            body: text + decoder.decode(),
        } as const;
    },
});
