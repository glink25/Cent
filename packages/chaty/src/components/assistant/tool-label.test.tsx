import {
    createTool,
    type Message,
    type Tool,
    type ToolMessage,
} from "@glink25/agent-core";
import {
    adaptHostRuntime,
    createHostProvider,
    createHostTool,
} from "@glink25/agent-core/bridge";
import type {
    AIChatInitPayload,
    HostBridge,
} from "@glink25/agent-core/bridge/types";
import { googleAIStudioAdapter } from "@glink25/agent-core/providers/google";
import { openAICompatibleAdapter } from "@glink25/agent-core/providers/openai";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { PreviewStatus, ToolGroup } from "./flow";
import { I18nProvider } from "./i18n";
import { MessageBubble } from "./message";
import { toolLabel, turnPreview } from "./turn-model";
import { ConversationTurns } from "./turns";

const tool = createTool({
    name: "external_tool",
    label: "宿主工具名称",
    describe: "A model-facing capability description.",
    argSchema: z.object({ code: z.string() }),
    returnSchema: z.string(),
    handler: ({ code }) => code,
});
const tools: Tool[] = [tool as Tool];
const completed: ToolMessage = {
    role: "tool",
    raw: "",
    formatted: {
        id: "call",
        name: tool.name,
        params: { code: "PRIVATE_PARAMETER" },
        returns: "ok",
    },
};

function init(): AIChatInitPayload {
    return {
        configs: [],
        systemPrompt: "",
        presetPrompts: [],
        skills: [],
        tools: [
            {
                name: tool.name,
                label: tool.label,
                describe: tool.describe,
                argJsonSchema: { type: "object" },
                returnJsonSchema: { type: "string" },
            },
        ],
    };
}

function host(): HostBridge {
    return {
        callTool: vi.fn(async () => "ok"),
        requestAI: vi.fn(({ onDone }) => {
            onDone();
            return { cancel() {} };
        }),
    };
}

async function request(bridge: HostBridge, registered: Tool[]) {
    const stream = await createHostProvider(bridge).request({
        history: [],
        tools: registered,
    });
    for await (const _chunk of stream) {
        /* consume the host request */
    }
    return vi.mocked(bridge.requestAI).mock.calls[0][0].tools;
}

describe("tool registration boundary", () => {
    it("keeps a single label through createTool and direct registration", () => {
        expect(tool.label).toBe("宿主工具名称");
        expect(toolLabel(tool.name, tools)).toBe(tool.label);
        expect(
            toolLabel("direct", [
                { ...tools[0], name: "direct", label: "直接注册" },
            ]),
        ).toBe("直接注册");
    });

    it("falls back for absent, blank and unknown labels, preserving nonblank text verbatim", () => {
        for (const label of [undefined, "", " \n\t "]) {
            expect(toolLabel(tool.name, [{ ...tools[0], label }])).toBe(
                tool.name,
            );
        }
        expect(toolLabel("unknown", tools)).toBe("unknown");
        expect(
            toolLabel(tool.name, [{ ...tools[0], label: "  Host text  " }]),
        ).toBe("  Host text  ");
    });

    it("preserves labels through bridge adaptation and supports old hosts", () => {
        const bridge = host();
        const payload = init();
        const runtime = adaptHostRuntime(bridge, payload, {
            tools: [],
            skills: [],
        });
        expect(toolLabel(tool.name, runtime.tools)).toBe(tool.label);
        const legacy = createHostTool(bridge, {
            ...payload.tools[0],
            label: undefined,
        });
        expect(toolLabel(tool.name, [legacy])).toBe(tool.name);
        // A shared ledger contract must not overwrite the host's readable name.
        payload.tools = [
            { ...payload.tools[0], name: "query", label: "Host query" },
        ];
        expect(
            adaptHostRuntime(bridge, payload, {
                tools: [],
                skills: [],
            }).tools.find((item) => item.name === "query")?.label,
        ).toBe("Host query");
        payload.tools[0] = { ...payload.tools[0], label: undefined };
        expect(
            toolLabel(
                "query",
                adaptHostRuntime(bridge, payload, { tools: [], skills: [] })
                    .tools,
            ),
        ).toBe("query");
    });

    it("removes labels from both direct and cached host definitions sent to requestAI", async () => {
        const bridge = host();
        const injected = createHostTool(bridge, init().tools[0]);
        const definitions = await request(bridge, [...tools, injected]);
        for (const definition of definitions) {
            expect(definition).not.toHaveProperty("label");
            expect(definition.describe).toBe(tool.describe);
            expect(definition.name).toBe(tool.name);
        }
        expect(definitions[1].argJsonSchema).toEqual({ type: "object" });
    });

    it("excludes presentation metadata from OpenAI and Google model requests", () => {
        for (const adapter of [
            openAICompatibleAdapter,
            googleAIStudioAdapter,
        ]) {
            const body = JSON.stringify(
                adapter.buildBody(
                    {
                        apiKey: "",
                        apiUrl: "",
                        model: "test",
                        apiType: adapter.apiType,
                    },
                    [],
                    tools,
                    {},
                ),
            );
            expect(body).not.toContain(tool.label);
            expect(body).not.toContain('"label"');
            expect(body).toContain(tool.describe);
            expect(body).toContain(tool.name);
        }
    });
});

describe("tool presentation", () => {
    it("uses the same host name in both languages, with localized phases and no parameter summary", () => {
        const preview = turnPreview(
            [],
            {
                phase: "executing",
                name: tool.name,
                params: completed.formatted.params,
            },
            tools,
        );
        for (const locale of ["zh", "en"] as const) {
            const html = renderToStaticMarkup(
                <I18nProvider locale={locale}>
                    <PreviewStatus preview={preview} />
                    <ToolGroup messages={[completed]} tools={tools} />
                    <MessageBubble message={completed} tools={tools} />
                </I18nProvider>,
            );
            for (const node of [
                <PreviewStatus key="preview" preview={preview} />,
                <ToolGroup key="group" messages={[completed]} tools={tools} />,
                <MessageBubble
                    key="message"
                    message={completed}
                    tools={tools}
                />,
            ]) {
                const rendered = renderToStaticMarkup(
                    <I18nProvider locale={locale}>{node}</I18nProvider>,
                );
                expect(rendered).toContain(tool.label);
                expect(rendered).not.toContain("PRIVATE_PARAMETER");
            }
            expect(html).toContain(
                locale === "zh" ? "正在运行工具" : "Running tool",
            );
            expect(html).not.toContain("PRIVATE_PARAMETER");
            expect(html).toContain("icon-[mdi--console]");
        }
    });

    it("treats host text as plain text", () => {
        const preview = turnPreview(
            [],
            { phase: "executing", name: tool.name },
            [{ ...tools[0], label: "<img src=x onerror=alert(1)>" }],
        );
        const html = renderToStaticMarkup(
            <I18nProvider>
                <PreviewStatus preview={preview} />
            </I18nProvider>,
        );
        expect(html).toContain("&lt;img");
        expect(html).not.toContain("<img");
    });

    it("retains intermediate prose, thinking and completed names across tool stages", () => {
        const answer: Message = {
            role: "assistant",
            id: "answer",
            raw: "",
            formatted: { answer: "Interim answer" },
        };
        for (const phase of ["preparing", "executing"] as const) {
            const preview = turnPreview(
                [answer],
                { phase, name: tool.name },
                tools,
            );
            expect(preview.answer).toBe(answer);
            expect(preview.tool).toBe(tool.label);
        }
        expect(
            turnPreview([answer, completed], { phase: "thinking" }, tools)
                .completed,
        ).toBe(tool.label);
        const thought: Message = {
            role: "assistant",
            id: "thought",
            raw: "",
            formatted: { thought: "下一步检查。" },
        };
        expect(
            turnPreview(
                [answer, thought],
                { phase: "thinking", messageId: "thought" },
                tools,
            ),
        ).toMatchObject({ answer, thought: "下一步检查。" });
        expect(
            turnPreview([answer], { phase: "answering" }, tools).status,
        ).toBeUndefined();
    });

    it("keeps approval actions outside the closed execution process", () => {
        const html = renderToStaticMarkup(
            <I18nProvider locale="en">
                <ConversationTurns
                    history={[completed]}
                    pending
                    tools={tools}
                    contextEvents={[]}
                    approval={{
                        proposal: {
                            id: "approval",
                            title: "Confirm change",
                            diffs: [],
                        },
                        decide() {},
                    }}
                />
            </I18nProvider>,
        );
        expect(html).toContain("Confirm change");
        expect(html).toContain("Approve");
        expect(html).toContain("Reject");
        expect(html).toContain('aria-expanded="false"');
    });
});
