import {
    type SetStateAction,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { showFilePicker } from "@/components/file-picker";
import {
    createHostProvider,
    createHostSkills,
    createHostTools,
    resolveHostBridge,
} from "./bridge";
import {
    AssistantChatContent,
    AssistantChatRoot,
    type ChatShellConfig,
} from "./components/chat-shell";
import type { Tool } from "./core";
import { useAIChatStore } from "./store";
import { PlaygroundSkill, PlaygroundTool } from "./tools/playground";
import type { AIChatInitPayload, HostBridge } from "./types";

const AiChat = () => {
    const chats = useAIChatStore((s) => s.chats);
    const setChats = useAIChatStore((s) => s.setChats);
    const currentChatId = useAIChatStore((s) => s.currentChatId);
    const setCurrentChatIdValue = useAIChatStore((s) => s.setCurrentChatId);
    const [host, setHost] = useState<HostBridge>();
    const [initPayload, setInitPayload] = useState<AIChatInitPayload>();
    const [error, setError] = useState<string>();
    const [selectedConfigId, setSelectedConfigId] = useState<string>();
    const selectedConfigIdRef = useRef<string | undefined>(undefined);
    selectedConfigIdRef.current = selectedConfigId;
    const setCurrentChatId = useCallback(
        (updater: SetStateAction<string | undefined>) => {
            setCurrentChatIdValue(
                typeof updater === "function"
                    ? updater(useAIChatStore.getState().currentChatId)
                    : updater,
            );
        },
        [setCurrentChatIdValue],
    );

    useEffect(() => {
        let disposed = false;
        resolveHostBridge()
            .then(async (resolvedHost) => {
                const init = await resolvedHost.getInit?.();
                if (!init) {
                    throw new Error("AI chat host init payload is missing.");
                }
                if (disposed) return;
                setHost(resolvedHost);
                setInitPayload(init);
                setSelectedConfigId(
                    init.defaultConfigId ?? init.configs[0]?.id,
                );
            })
            .catch((err) => {
                if (disposed) return;
                setError(err instanceof Error ? err.message : String(err));
            });
        return () => {
            disposed = true;
        };
    }, []);

    const config = useMemo<ChatShellConfig | undefined>(() => {
        if (!host || !initPayload) return undefined;
        const hostTools = createHostTools({
            host,
            definitions: initPayload.tools,
        });
        const hostSkills = createHostSkills({
            host,
            definitions: initPayload.skills,
        });
        return {
            provider: createHostProvider({
                host,
                getConfigId: () => selectedConfigIdRef.current,
            }),
            tools: [...hostTools, PlaygroundTool as Tool],
            skills: [...hostSkills, PlaygroundSkill],
            systemPrompt: initPayload.systemPrompt,
            configs: initPayload.configs,
            defaultConfigId: selectedConfigId,
            onDefaultConfigChange: (id) => setSelectedConfigId(id),
            presetPrompts: initPayload.presetPrompts,
            pickFiles: showFilePicker,
            title: "AI Chat",
        };
    }, [host, initPayload, selectedConfigId]);

    if (error) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center gap-2 p-4 text-center">
                <i className="icon-[mdi--alert-circle-outline] size-8 text-destructive"></i>
                <div className="font-medium">AI Chat unavailable</div>
                <div className="max-w-sm text-sm opacity-70">{error}</div>
            </div>
        );
    }

    if (!config) {
        return (
            <div className="flex min-h-dvh flex-col items-center justify-center p-4">
                <i className="icon-[mdi--loading] size-8 animate-spin opacity-70"></i>
            </div>
        );
    }

    return (
        <AssistantChatRoot
            chats={chats}
            setChats={setChats}
            currentChatId={currentChatId}
            setCurrentChatId={setCurrentChatId}
            config={config}
        >
            <div className="flex h-full flex-col overflow-hidden">
                <AssistantChatContent
                    showHeader={false}
                    actionsPlacement="floating"
                />
            </div>
        </AssistantChatRoot>
    );
};

export default AiChat;
