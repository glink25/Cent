import {
    createContext,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { toast } from "sonner";
import { v4 } from "uuid";
import { Button } from "@/components/ui/button";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useIntl } from "@/locale";
import type {
    AbortablePromise,
    AssistantMessage,
    History,
    Provider,
    SkillInput,
    Tool,
    TurnResult,
} from "../core";
import { createSession } from "../core";
import { MessageBubble } from "./message";

export type ChatShellInput = { text: string; assets: File[] };

export type ChatShellChat = {
    id: string;
    history: History;
    pending?: boolean;
    abortController?: AbortablePromise<AsyncIterable<TurnResult>>;
};

export type ChatShellModelConfig = {
    id: string;
    name: string;
};

export type ChatShellPresetPrompt = {
    id: string;
    label: string;
    prompt: string;
};

export type ChatShellConfig = {
    provider: Provider;
    tools: Tool[];
    skills: SkillInput[];
    systemPrompt: string;
    configs?: ChatShellModelConfig[];
    defaultConfigId?: string;
    onDefaultConfigChange?: (configId: string) => void | Promise<void>;
    presetPrompts?: ChatShellPresetPrompt[];
    pickFiles?: (options: { multiple: boolean }) => Promise<File[]>;
    title?: string;
};

type AssistantContext = {
    input: ChatShellInput;
    setInput: Dispatch<SetStateAction<ChatShellInput>>;
    chats: ChatShellChat[];
    setChats: (updater: SetStateAction<ChatShellChat[]>) => void;
    currentChatId: ChatShellChat["id"] | undefined;
    setCurrentChatId: Dispatch<SetStateAction<ChatShellChat["id"] | undefined>>;
    config: ChatShellConfig;
    canSend: boolean;
    send: () => void;
    abortCurrentChat: () => void;
    rerunToolCall: (messageIndex: number) => void;
};

const AssistantContext = createContext<AssistantContext | null>(null);

const useAssistantContext = () => {
    const ctx = useContext(AssistantContext);
    if (!ctx) {
        throw new Error("AssistantContext init failed");
    }
    return ctx;
};

export function AssistantChatRoot({
    children,
    chats,
    setChats,
    currentChatId,
    setCurrentChatId,
    config,
}: {
    children?: ReactNode;
    chats: ChatShellChat[];
    setChats: (updater: SetStateAction<ChatShellChat[]>) => void;
    currentChatId: ChatShellChat["id"] | undefined;
    setCurrentChatId: Dispatch<SetStateAction<ChatShellChat["id"] | undefined>>;
    config: ChatShellConfig;
}) {
    const [input, setInput] = useState<ChatShellInput>({
        text: "",
        assets: [],
    });

    const updateChat = useCallback(
        (
            chatId: string,
            updater: (prev: ChatShellChat, exist: boolean) => ChatShellChat,
        ) => {
            setChats((prev) => {
                const index = prev.findIndex((v) => v.id === chatId);
                if (index === -1) {
                    return [
                        ...prev,
                        updater({ id: chatId, history: [] }, false),
                    ];
                }
                const newV = [...prev];
                newV[index] = updater(prev[index], true);
                return newV;
            });
        },
        [setChats],
    );

    const currentChat = chats.find((c) => c.id === currentChatId);
    const canSend = !currentChat?.pending;

    const abortCurrentChat = useCallback(() => {
        if (currentChatId) {
            const chat = chats.find((c) => c.id === currentChatId);
            if (chat?.abortController) {
                chat.abortController.abort();
                updateChat(currentChatId, (prev) => ({
                    ...prev,
                    pending: false,
                    abortController: undefined,
                }));
            }
        }
    }, [currentChatId, chats, updateChat]);

    const makeSession = useCallback(
        (history: History) =>
            createSession({
                history,
                provider: config.provider,
                tools: config.tools,
                skills: config.skills,
                systemPrompt: config.systemPrompt,
            }),
        [config],
    );

    const send = useCallback(async () => {
        if (input.assets.length === 0 && input.text.length === 0) {
            return;
        }
        const prevChat: ChatShellChat =
            currentChat === undefined
                ? {
                      history: [],
                      id: v4(),
                  }
                : currentChat;
        const next = makeSession(prevChat.history);
        setInput({ text: "", assets: [] });

        try {
            const promise = next({
                message: input.text,
                assets: input.assets,
            });

            updateChat(prevChat.id, (prev, exist) => {
                if (!exist) {
                    Promise.resolve().then(() => {
                        setCurrentChatId(prevChat.id);
                    });
                }
                return {
                    ...prev,
                    pending: true,
                    abortController: promise,
                };
            });

            const stream = await promise;
            for await (const chunk of stream) {
                updateChat(prevChat.id, (prev) => {
                    return { ...prev, history: chunk.history };
                });
            }

            updateChat(prevChat.id, (prev) => ({
                ...prev,
                pending: false,
                abortController: undefined,
            }));
        } catch (error) {
            if ((error as { name?: string })?.name !== "AbortError") {
                console.error(error);
                const errorMsg =
                    error instanceof Error
                        ? error.message
                        : JSON.stringify(error);
                toast.error(errorMsg);
            }

            updateChat(prevChat.id, (prev) => ({
                ...prev,
                pending: false,
                abortController: undefined,
            }));
        }
    }, [input, currentChat, makeSession, updateChat, setCurrentChatId]);

    const rerunToolCall = useCallback(
        async (messageIndex: number) => {
            const chat = chats.find((c) => c.id === currentChatId);
            if (!chat) return;
            const session = makeSession(chat.history);
            try {
                const result = await session.rerunToolCall(messageIndex);
                console.log("[rerun tool]", messageIndex, result);
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : String(error),
                );
            }
        },
        [chats, currentChatId, makeSession],
    );

    const ctx = useMemo(
        () => ({
            input,
            setInput,
            chats,
            setChats,
            currentChatId,
            setCurrentChatId,
            config,
            canSend,
            send,
            abortCurrentChat,
            rerunToolCall,
        }),
        [
            input,
            chats,
            setChats,
            currentChatId,
            setCurrentChatId,
            config,
            canSend,
            send,
            abortCurrentChat,
            rerunToolCall,
        ],
    );
    return (
        <AssistantContext.Provider value={ctx}>
            {children}
        </AssistantContext.Provider>
    );
}

function ModelSwitcher() {
    const t = useIntl();
    const { config } = useAssistantContext();
    const configs = config.configs ?? [];
    const defaultConfigId = config.defaultConfigId;
    const [open, setOpen] = useState(false);

    if (configs.length === 0) {
        return null;
    }

    const currentConfig = configs.find((c) => c.id === defaultConfigId);
    const label = currentConfig?.name ?? t("switch-model");

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={label}
                    className="inline-flex items-center gap-1 h-8 px-2 rounded-full text-xs text-foreground/70 hover:text-foreground hover:bg-muted max-w-[140px] cursor-pointer"
                >
                    <span className="truncate">{label}</span>
                    <i className="icon-[mdi--unfold-more-horizontal] size-3.5 flex-shrink-0 opacity-70"></i>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-52 p-1" align="start" side="top">
                <div className="max-h-72 overflow-y-auto">
                    {configs.map((item) => (
                        <button
                            type="button"
                            key={item.id}
                            onClick={() => {
                                void config.onDefaultConfigChange?.(item.id);
                                setOpen(false);
                            }}
                            className={`group flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent ${
                                item.id === defaultConfigId ? "bg-accent" : ""
                            }`}
                        >
                            <span className="truncate flex-1 text-left">
                                {item.name}
                            </span>
                            {item.id === defaultConfigId && (
                                <i className="icon-[mdi--check] size-4"></i>
                            )}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

export function AssistantChatActions() {
    const t = useIntl();
    const { chats, currentChatId, setCurrentChatId, setChats } =
        useAssistantContext();
    const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

    return (
        <div className="flex items-center">
            <Button
                variant={"ghost"}
                onClick={() => {
                    setCurrentChatId(undefined);
                }}
            >
                <i className="icon-[mdi--comment-add-outline] size-5"></i>
            </Button>
            <Popover open={isChatMenuOpen} onOpenChange={setIsChatMenuOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        className="border-none shadow-none !text-foreground px-2"
                    >
                        <i className="icon-[mdi--menu] size-5"></i>
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-52 p-1" align="end">
                    <div className="max-h-72 overflow-y-auto">
                        {chats.length === 0 && (
                            <div className="px-2 py-3 text-sm opacity-70 text-center">
                                {t("no-chats")}
                            </div>
                        )}
                        {chats.map((chat) => {
                            const title =
                                (
                                    chat.history.findLast(
                                        (v) =>
                                            v.role === "assistant" &&
                                            v.formatted.overview?.length,
                                    ) as AssistantMessage | undefined
                                )?.formatted.overview ?? t("untitled-chat");
                            return (
                                <div
                                    key={chat.id}
                                    className={`group flex items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent ${
                                        currentChatId === chat.id
                                            ? "bg-accent"
                                            : ""
                                    }`}
                                >
                                    {currentChatId === chat.id && (
                                        <i className="ml-auto icon-[mdi--check]"></i>
                                    )}
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setCurrentChatId(chat.id);
                                            setIsChatMenuOpen(false);
                                        }}
                                        className="min-w-0 flex-1 flex items-center gap-2 text-left"
                                    >
                                        {chat.pending && (
                                            <span className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                                        )}
                                        <span className="truncate">
                                            {title}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            setChats((prev) =>
                                                prev.filter(
                                                    (c) => c.id !== chat.id,
                                                ),
                                            );
                                            if (currentChatId === chat.id) {
                                                setCurrentChatId(undefined);
                                            }
                                        }}
                                        className="rounded-sm p-1 opacity-60 hover:opacity-100 hover:bg-accent text-foreground/80 flex justify-center items-center"
                                        aria-label="Delete chat"
                                    >
                                        <i className="icon-[mdi--close] size-4"></i>
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </PopoverContent>
            </Popover>
        </div>
    );
}

export function AssistantChatContent({
    showHeader = true,
    actionsPlacement = showHeader ? "header" : "none",
}: {
    showHeader?: boolean;
    actionsPlacement?: "header" | "floating" | "none";
}) {
    const t = useIntl();
    const {
        input,
        setInput,
        send,
        canSend,
        chats,
        currentChatId,
        abortCurrentChat,
        rerunToolCall,
        config,
    } = useAssistantContext();
    const currentChat = chats.find((c) => c.id === currentChatId);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const presetPrompts = config.presetPrompts ?? [
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
    ];

    useEffect(() => {
        if (currentChat?.history.length && currentChatId) {
            messagesContainerRef.current?.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [currentChat?.history.length, currentChatId]);

    const sendRef = useRef(send);
    sendRef.current = send;

    return (
        <div className="w-full flex-1 flex flex-col overflow-hidden relative">
            {showHeader && (
                <div className="hidden md:flex justify-center items-center py-2 h-12">
                    <div>{config.title ?? t("ai-assistant")}</div>
                    <div className="absolute right-2">
                        {actionsPlacement === "header" && (
                            <AssistantChatActions />
                        )}
                    </div>
                </div>
            )}
            {actionsPlacement === "floating" && (
                <div className="absolute right-2 top-2 z-20 rounded-full border bg-background/90 shadow-sm backdrop-blur">
                    <AssistantChatActions />
                </div>
            )}
            <div
                ref={messagesContainerRef}
                className={`w-full flex-1 flex flex-col gap-4 overflow-y-auto px-2 py-2 pb-[200px] text-sm ${
                    actionsPlacement === "floating" ? "pt-12" : ""
                }`}
            >
                {currentChat ? (
                    currentChat.history.map((message, i) => (
                        <MessageBubble
                            key={i}
                            message={message}
                            onRerunToolCall={() => rerunToolCall(i)}
                        />
                    ))
                ) : (
                    <div className="w-full h-full flex flex-col gap-4 justify-center items-center">
                        <i className="icon-[mdi--shimmer-outline] size-12 text-lg bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600"></i>
                        {t("start-talk-to-ai")}
                    </div>
                )}
            </div>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 bottom-[-10px] h-[170px] bg-gradient-to-b from-transparent via-background/70 to-background/95 backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"
            />
            <div className="w-full absolute left-0 bottom-0 px-2 py-4 flex flex-col gap-2">
                <div className="w-full flex overflow-x-auto scrollbar-hidden gap-2">
                    {presetPrompts.map((question) => (
                        <button
                            key={question.id}
                            type="button"
                            onClick={async () => {
                                if (canSend) {
                                    setInput((v) => ({
                                        ...v,
                                        text: question.prompt,
                                    }));
                                    await Promise.resolve();
                                    sendRef.current();
                                }
                            }}
                            className="rounded-full border shadow py-1 px-2 text-xs hover:bg-muted cursor-pointer bg-background flex-shrink-0"
                        >
                            {question.label}
                        </button>
                    ))}
                </div>
                <div className="rounded-2xl w-full border shadow p-1 flex flex-col gap-2 bg-background">
                    {input.assets.length > 0 && (
                        <div className="flex gap-2 px-2 overflow-x-auto scrollbar-hidden">
                            {input.assets.map((file, i) => (
                                <div
                                    key={`${file.name}-${i}`}
                                    className="flex-shrink-0 bg-muted rounded p-2 text-xs flex items-center gap-2"
                                >
                                    <i className="icon-[mdi--file-outline] size-4"></i>
                                    <span className="max-w-24 truncate">
                                        {file.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setInput((v) => ({
                                                ...v,
                                                assets: v.assets.filter(
                                                    (_, idx) => idx !== i,
                                                ),
                                            }))
                                        }
                                        className="hover:bg-accent rounded p-0.5"
                                    >
                                        <i className="icon-[mdi--close] size-3"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    <textarea
                        value={input.text}
                        onChange={(e) => {
                            setInput((v) => ({
                                ...v,
                                text: e.target.value,
                            }));
                        }}
                        onKeyDown={(e) => {
                            if (e.nativeEvent.isComposing) {
                                return;
                            }
                            if (
                                e.key === "Enter" &&
                                !e.shiftKey &&
                                !e.metaKey &&
                                !e.ctrlKey
                            ) {
                                e.preventDefault();
                                if (canSend) {
                                    send();
                                }
                            }
                        }}
                        className="w-full h-10 p-2 resize-none !outline-none text-sm"
                    ></textarea>
                    <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1">
                            <Button
                                variant="ghost"
                                className="rounded-full p-0 w-8 h-8"
                                disabled={!config.pickFiles}
                                onClick={async () => {
                                    if (!config.pickFiles) return;
                                    if (input.assets.length >= 3) {
                                        toast.error("最多上传3个附件");
                                        return;
                                    }
                                    const files = await config.pickFiles({
                                        multiple: true,
                                    });
                                    const remaining = 3 - input.assets.length;
                                    setInput((v) => ({
                                        ...v,
                                        assets: [
                                            ...v.assets,
                                            ...files.slice(0, remaining),
                                        ],
                                    }));
                                }}
                            >
                                <i className="icon-[mdi--plus] size-5"></i>
                            </Button>
                            <ModelSwitcher />
                        </div>

                        {currentChat?.pending ? (
                            <Button
                                variant="ghost"
                                className="rounded-full p-0 w-8 h-8 bg-destructive hover:bg-destructive/80 text-destructive-foreground"
                                onClick={abortCurrentChat}
                            >
                                <i className="icon-[mdi--stop] size-4"></i>
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                className="rounded-full p-0 w-8 h-8 bg-foreground/10 hover:bg-foreground/40"
                                disabled={!canSend}
                                onClick={send}
                            >
                                <i className="icon-[mdi--send] size-4"></i>
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
