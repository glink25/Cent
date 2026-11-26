import { z } from "zod";
import {
    assistantAuthorizationGeneration,
    hasAssistantGrant,
    rememberAssistantGrant,
} from "@/agent/assistant-grants";
import { createTool, finishToolAuthorization } from "@/assistant";
import { originalFetch } from "@/utils/fetch-proxy";
import { assistantScope, useAssistantLauncher } from "../launcher";

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
    handler: async ({ url, method, body, contentType }, context) => {
        if (
            context.surface !== "native" ||
            context.source ||
            !context.authorizeTool ||
            !useAssistantLauncher.getState().open
        ) {
            throw new Error("Tool authorization is unavailable");
        }
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
        target.hash = "";
        const scope = assistantScope();
        const [, book, account] = JSON.parse(scope) as [
            unknown,
            unknown,
            unknown,
        ];
        if (!book || account == null || account === "")
            throw new Error("No active ledger");
        const generation = assistantAuthorizationGeneration(scope);
        const key = JSON.stringify([scope, "chat", "website", target.origin]);
        const closed = new AbortController();
        const unsubscribe = useAssistantLauncher.subscribe((state) => {
            if (!state.open) closed.abort();
        });
        const signal = AbortSignal.any(
            context.signal ? [context.signal, closed.signal] : [closed.signal],
        );
        const execute = () => {
            signal.throwIfAborted();
            if (
                assistantScope() !== scope ||
                assistantAuthorizationGeneration(scope) !== generation
            )
                throw new Error("Website authorization expired");
            return requestWebsite(target, method, body, contentType, signal);
        };
        try {
            if (hasAssistantGrant(scope, key)) return await execute();
            return await finishToolAuthorization(
                {
                    id: crypto.randomUUID(),
                    scope: { type: "website", origin: target.origin },
                    details: {
                        url: target.href,
                        method,
                        ...(method === "POST"
                            ? {
                                  contentType: contentType ?? "text/plain",
                                  body: body ?? "",
                              }
                            : {}),
                    },
                    canRemember: true,
                },
                async (_id, approved, remember) => {
                    if (!approved)
                        throw new Error("Tool authorization was denied");
                    signal.throwIfAborted();
                    if (
                        assistantScope() !== scope ||
                        assistantAuthorizationGeneration(scope) !== generation
                    )
                        throw new Error("Website authorization expired");
                    if (remember)
                        rememberAssistantGrant(scope, key, generation);
                    return execute();
                },
                context.authorizeTool,
                signal,
            );
        } finally {
            unsubscribe();
        }
    },
});

async function requestWebsite(
    target: URL,
    method: "GET" | "HEAD" | "POST",
    body: string | undefined,
    contentType: (typeof contentTypes)[number] | undefined,
    signal: AbortSignal,
) {
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
        signal: AbortSignal.any([signal, timeout]),
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
}
