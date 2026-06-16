import { useEffect, useMemo, useRef } from "react";
import { z } from "zod";
import { useIntl } from "@/locale";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import { decodeApiKey } from "@/utils/api-key";
import type { History, SkillInput, Tool } from "./core";
import { executeToolCall, isZodSchema } from "./core/tooling";
import {
    createStreamingRequest,
    getAIConfig,
    parseGoogleStream,
    parseOpenAIStream,
} from "./request";
import { CentAIChatHostConfig } from "./tools";
import { historyToMessages } from "./tools/provider";
import type {
    AIChatChildMessage,
    AIChatInitPayload,
    AIChatParentMessage,
    AIChatSkillDefinition,
    AIChatToolDefinition,
} from "./types";

function postToFrame(
    frame: HTMLIFrameElement | null,
    message: AIChatParentMessage,
) {
    frame?.contentWindow?.postMessage(message, window.location.origin);
}

function errorToMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    if (typeof error === "string") return error;
    try {
        return JSON.stringify(error);
    } catch {
        return String(error);
    }
}

function schemaToJsonSchema(schema: unknown): Record<string, unknown> {
    if (!isZodSchema(schema)) return {};
    return z.toJSONSchema(schema) as Record<string, unknown>;
}

function toolToDefinition(tool: Tool): AIChatToolDefinition {
    return {
        name: tool.name,
        describe: tool.describe,
        argJsonSchema: schemaToJsonSchema(tool.argSchema),
        returnJsonSchema: schemaToJsonSchema(tool.returnSchema),
    };
}

async function skillToDefinition(
    skill: SkillInput,
    includeContent: boolean,
): Promise<AIChatSkillDefinition> {
    const id = (skill as { id?: string; name?: string }).id ?? skill.name;
    const content =
        includeContent &&
        "content" in skill &&
        typeof skill.content === "string"
            ? skill.content
            : undefined;
    return {
        id,
        name: skill.name,
        description: skill.description,
        content,
    };
}

async function loadSkill(id: string) {
    const skill = (CentAIChatHostConfig.skills as SkillInput[]).find(
        (item) => ((item as { id?: string }).id ?? item.name) === id,
    );
    if (!skill) {
        throw new Error(`Skill not found: ${id}`);
    }
    if ("content" in skill && typeof skill.content === "string") {
        return skillToDefinition(skill, true);
    }
    if ("loader" in skill && typeof skill.loader === "function") {
        const content = await skill.loader();
        return {
            ...(await skillToDefinition(skill, false)),
            content,
        };
    }
    return skillToDefinition(skill, false);
}

export function AIChatFrame() {
    const t = useIntl();
    const frameRef = useRef<HTMLIFrameElement>(null);
    const requests = useRef(new Map<string, AbortController>());
    const userId = useUserStore((s) => s.id);
    const assistantData = useLedgerStore(
        (s) => s.infos?.meta.personal?.[userId]?.assistant,
    );

    const initPayload = useMemo<AIChatInitPayload>(() => {
        const configs =
            assistantData?.configs?.map((config) => ({
                id: config.id,
                name: config.name,
            })) ?? [];
        if (configs.length === 0 && assistantData?.bigmodel?.apiKey) {
            configs.push({
                id: "legacy-bigmodel",
                name: "智谱GLM (Legacy)",
            });
        }

        return {
            configs,
            defaultConfigId: assistantData?.defaultConfigId ?? configs[0]?.id,
            systemPrompt: CentAIChatHostConfig.systemPrompt,
            presetPrompts: [
                {
                    id: "analyze-ledger",
                    label: t("preset_question.analyze_ledger.label"),
                    prompt: t("preset_question.analyze_ledger.prompt"),
                },
                {
                    id: "monthly-budget",
                    label: t("preset_question.monthly_budget.label"),
                    prompt: t("preset_question.monthly_budget.prompt"),
                },
                {
                    id: "import-bills",
                    label: t("preset_question.import_bills.label"),
                    prompt: t("preset_question.import_bills.prompt"),
                },
                {
                    id: "annual-summary",
                    label: t("preset_question.annual_summary.label"),
                    prompt: t("preset_question.annual_summary.prompt"),
                },
            ],
            tools: CentAIChatHostConfig.tools
                .filter((tool) => tool.name !== "playground")
                .map(toolToDefinition),
            skills: (CentAIChatHostConfig.skills as SkillInput[]).map(
                (skill) => {
                    const id =
                        (skill as { id?: string; name?: string }).id ??
                        skill.name;
                    return {
                        id,
                        name: skill.name,
                        description: skill.description,
                        content:
                            "content" in skill &&
                            typeof skill.content === "string"
                                ? skill.content
                                : undefined,
                    };
                },
            ),
            locale: undefined,
            theme: undefined,
        };
    }, [assistantData, t]);

    useEffect(() => {
        const onMessage = async (event: MessageEvent<AIChatChildMessage>) => {
            if (event.origin !== window.location.origin) return;
            const message = event.data;
            if (!message || typeof message !== "object") return;

            if (message.type === "cent-ai-chat:init-request") {
                postToFrame(frameRef.current, {
                    type: "cent-ai-chat:init",
                    payload: initPayload,
                });
                return;
            }

            if (message.type === "cent-ai-chat:request-cancel") {
                requests.current.get(message.requestId)?.abort();
                requests.current.delete(message.requestId);
                return;
            }

            if (message.type === "cent-ai-chat:request-ai") {
                const abortController = new AbortController();
                requests.current.set(message.requestId, abortController);
                try {
                    const config = getAIConfig(message.configId);
                    const decodedConfig = {
                        ...config,
                        apiKey: decodeApiKey(config.apiKey),
                    };
                    const response = await createStreamingRequest(
                        decodedConfig,
                        decodedConfig.apiKey,
                        await historyToMessages(message.history as History),
                        abortController.signal,
                    );
                    if (!response.ok) {
                        const errorText = await response.text();
                        throw new Error(
                            `AI API 请求失败: ${response.status} ${response.statusText}. ${errorText}`,
                        );
                    }
                    const parser =
                        decodedConfig.apiType === "google-ai-studio"
                            ? parseGoogleStream
                            : parseOpenAIStream;
                    for await (const chunk of parser(response)) {
                        postToFrame(frameRef.current, {
                            type: "cent-ai-chat:request-chunk",
                            requestId: message.requestId,
                            chunk,
                        });
                    }
                    postToFrame(frameRef.current, {
                        type: "cent-ai-chat:request-done",
                        requestId: message.requestId,
                    });
                } catch (error) {
                    if (!abortController.signal.aborted) {
                        postToFrame(frameRef.current, {
                            type: "cent-ai-chat:request-error",
                            requestId: message.requestId,
                            error: errorToMessage(error),
                        });
                    }
                } finally {
                    requests.current.delete(message.requestId);
                }
                return;
            }

            if (message.type === "cent-ai-chat:tool-call") {
                try {
                    const toolMap = new Map(
                        CentAIChatHostConfig.tools.map((tool) => [
                            tool.name,
                            tool,
                        ]),
                    );
                    const result = await executeToolCall(
                        toolMap,
                        {
                            name: message.name,
                            params: message.params,
                        },
                        {
                            history: message.history as History,
                            tools: CentAIChatHostConfig.tools,
                        },
                    );
                    if (result.formatted.errors !== undefined) {
                        throw new Error(
                            errorToMessage(result.formatted.errors),
                        );
                    }
                    postToFrame(frameRef.current, {
                        type: "cent-ai-chat:tool-result",
                        callId: message.callId,
                        success: true,
                        result: result.formatted.returns,
                    });
                } catch (error) {
                    postToFrame(frameRef.current, {
                        type: "cent-ai-chat:tool-result",
                        callId: message.callId,
                        success: false,
                        error: errorToMessage(error),
                    });
                }
                return;
            }

            if (message.type === "cent-ai-chat:skill-call") {
                try {
                    postToFrame(frameRef.current, {
                        type: "cent-ai-chat:skill-result",
                        callId: message.callId,
                        success: true,
                        result: await loadSkill(message.id),
                    });
                } catch (error) {
                    postToFrame(frameRef.current, {
                        type: "cent-ai-chat:skill-result",
                        callId: message.callId,
                        success: false,
                        error: errorToMessage(error),
                    });
                }
            }
        };

        window.addEventListener("message", onMessage);
        return () => {
            window.removeEventListener("message", onMessage);
            requests.current.forEach((controller) => controller.abort());
            requests.current.clear();
        };
    }, [initPayload]);

    return (
        <iframe
            ref={frameRef}
            title="AI Chat"
            src="/ai-chat.html"
            className="w-full h-full border-0 bg-background"
        />
    );
}
