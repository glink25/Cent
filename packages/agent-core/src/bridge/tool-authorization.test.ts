import { describe, expect, it, vi } from "vitest";
import type { ToolAuthorizationRequest, ToolContext } from "../assistant";
import { adaptHostRuntime, createHostTool } from "./host";
import type { AIChatInitPayload, HostBridge } from "./types";

const tool = {
    name: "nativeFetch",
    describe: "Fetch a public website",
    returnJsonSchema: {},
};

const request: ToolAuthorizationRequest = {
    id: "pending",
    scope: { type: "website", origin: "https://example.com" },
    details: {
        url: "https://example.com/a?q=b",
        method: "POST",
        body: "original",
    },
    canRemember: true,
};

const args = { url: request.details.url, method: "POST", body: "original" };

function setup() {
    const network = vi.fn(() => ({ type: "http", status: 200, body: "ok" }));
    const callTool = vi.fn();
    const toolAuthorization = vi.fn<
        NonNullable<HostBridge["toolAuthorization"]>
    >(async (action) => {
        if (action.operation === "prepare")
            return { kind: "toolAuthorization", request };
        if (action.approved) return network();
        return undefined;
    });
    const host = createHostTool({ callTool, toolAuthorization }, tool);
    const context: ToolContext = { history: [], tools: [], surface: "native" };
    return { callTool, context, host, network, toolAuthorization };
}

describe("host tool authorization", () => {
    it("waits for approval and sends only the decision to execute the prepared request", async () => {
        const { callTool, context, host, network, toolAuthorization } = setup();
        const { promise, resolve } = Promise.withResolvers<{
            approved: boolean;
            remember: boolean;
        }>();
        const authorizeTool = vi.fn(() => promise);
        const result = host.handler(args, { ...context, authorizeTool });
        await Promise.resolve();

        expect(authorizeTool).toHaveBeenCalledWith(request, undefined);
        expect(network).not.toHaveBeenCalled();
        resolve({ approved: true, remember: true });
        await expect(result).resolves.toEqual({
            type: "http",
            status: 200,
            body: "ok",
        });

        expect(callTool).not.toHaveBeenCalled();
        expect(toolAuthorization.mock.calls.map(([action]) => action)).toEqual([
            { operation: "prepare", name: "nativeFetch", params: args },
            {
                operation: "decide",
                authorizationId: request.id,
                approved: true,
                remember: true,
            },
        ]);
    });

    it.each(["deny", "cancel"] as const)(
        "does not execute after %s",
        async (action) => {
            const { context, host, network, toolAuthorization } = setup();
            const controller = new AbortController();
            await expect(
                host.handler(args, {
                    ...context,
                    signal: controller.signal,
                    authorizeTool: async () => {
                        if (action === "cancel") controller.abort();
                        return {
                            approved: action === "cancel",
                            remember: true,
                        };
                    },
                }),
            ).rejects.toThrow();
            expect(toolAuthorization.mock.calls[1][0]).toEqual({
                operation: "decide",
                authorizationId: request.id,
                approved: false,
                remember: false,
            });
            expect(network).not.toHaveBeenCalled();
        },
    );

    it("requires the authorized surface and hides the tool from old mobile hosts", async () => {
        const { callTool, context, host, toolAuthorization } = setup();
        await expect(host.handler(args, context)).rejects.toThrow(
            "authorization is unavailable",
        );
        await expect(
            host.handler(args, {
                ...context,
                surface: "code",
                authorizeTool: async () => ({ approved: true }),
            }),
        ).rejects.toThrow("authorization is unavailable");
        expect(toolAuthorization).not.toHaveBeenCalled();
        const init: AIChatInitPayload = {
            tools: [tool],
            configs: [],
            skills: [],
            presetPrompts: [],
            systemPrompt: "",
        };
        const runtime = adaptHostRuntime(
            { callTool, requestAI: vi.fn() },
            init,
            { tools: [], skills: [] },
        );
        expect(runtime.tools.some((item) => item.name === tool.name)).toBe(
            false,
        );
    });
});
