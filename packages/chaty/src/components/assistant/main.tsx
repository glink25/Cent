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
import {
    type AssistantMessage,
    createSession,
    type History,
} from "../../assistant";
import { showFilePicker } from "../file-picker";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { I18nProvider, useI18n } from "./i18n";
import { MessageBubble } from "./message";
import type { RuntimeConfig } from "./runtime";
import { type Chat, useAssistantChatStore } from "./state";
import { applyThemePreference } from "./theme";

type Input = { text: string; assets: File[] };

type AssistantContext = {
    input: Input;
    setInput: Dispatch<SetStateAction<Input>>;
    chats: Chat[];
    setChats: (updater: SetStateAction<Chat[]>) => void;
    currentChatId: Chat["id"] | undefined;
    setCurrentChatId: Dispatch<SetStateAction<Chat["id"] | undefined>>;
    runtime: RuntimeConfig;
    selectedConfigId?: string;
    setSelectedConfigId: (configId: string) => void;
    canSend: boolean;
    send: (nextInput?: Input) => void;
    abortCurrentChat: () => void;
    rerunToolCall: (messageIndex: number) => void;
};

const EMPTY_INPUT: Input = { text: "", assets: [] };
const AssistantContext = createContext<AssistantContext | null>(null);

const useAssistantContext = () => {
    const ctx = useContext(AssistantContext);
    if (!ctx) {
        throw new Error("AssistantContext init failed");
    }
    return ctx;
};

function createChatId() {
    return (
        globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`
    );
}

function normalizeHistory(history: History): History {
    return history.map((message, index) => ({
        ...message,
        id:
            message.id ??
            `${message.role}-${index}-${message.raw.slice(0, 48)}`,
    }));
}

function isAbortError(error: unknown) {
    return (
        (error instanceof DOMException && error.name === "AbortError") ||
        (error instanceof Error && error.name === "AbortError")
    );
}

function Root({
    children,
    runtime,
    selectedConfigId: controlledConfigId,
    onConfigChange,
}: {
    children?: ReactNode;
    runtime: RuntimeConfig;
    /** 受控的模型选择。传入时由宿主托管（如 cent 写回 ledger）；不传则内部管理。 */
    selectedConfigId?: string;
    onConfigChange?: (configId: string) => void;
}) {
    const [input, setInput] = useState<Input>(EMPTY_INPUT);
    const [currentChatId, setCurrentChatId] = useState<Chat["id"]>();
    const activeRequestsRef = useRef(new Set<{ abort: () => void }>());
    const initialConfigId = useMemo(() => {
        const fallbackConfigId = runtime.configs[0]?.id;
        return runtime.configs.some(
            (config) => config.id === runtime.defaultConfigId,
        )
            ? runtime.defaultConfigId
            : fallbackConfigId;
    }, [runtime.defaultConfigId, runtime.configs]);
    const [internalConfigId, setInternalConfigId] = useState(initialConfigId);
    const isConfigControlled = controlledConfigId !== undefined;
    const selectedConfigId = isConfigControlled
        ? controlledConfigId
        : internalConfigId;
    const setSelectedConfigId = useCallback(
        (configId: string) => {
            if (!isConfigControlled) {
                setInternalConfigId(configId);
            }
            onConfigChange?.(configId);
        },
        [isConfigControlled, onConfigChange],
    );
    const chats = useAssistantChatStore((s) => s.chats);
    const setAllChats = useAssistantChatStore((s) => s.setChats);
    const scope = runtime.scope ?? null;
    const scopedChats = useMemo(
        () => chats.filter((chat) => chat.scope === scope),
        [chats, scope],
    );
    const setChats = useCallback(
        (updater: SetStateAction<Chat[]>) => {
            setAllChats((allChats) => {
                const current = allChats.filter((chat) => chat.scope === scope);
                const next =
                    typeof updater === "function"
                        ? (updater as (prev: Chat[]) => Chat[])(current)
                        : updater;
                return [
                    ...allChats.filter((chat) => chat.scope !== scope),
                    ...next.map((chat) => ({ ...chat, scope })),
                ];
            });
        },
        [scope, setAllChats],
    );

    useEffect(() => applyThemePreference(runtime.theme), [runtime.theme]);

    useEffect(() => {
        setInput(EMPTY_INPUT);
        setCurrentChatId(undefined);
        return () => {
            for (const request of activeRequestsRef.current) {
                request.abort();
            }
        };
    }, []);

    const currentChat = scopedChats.find((chat) => chat.id === currentChatId);
    const canSend =
        !currentChat?.pending &&
        (input.assets.length > 0 || input.text.trim().length > 0);

    // updater 形式便于在「新建会话」与「更新流式历史 / pending 状态」间复用。
    const updateChat = useCallback(
        (chatId: string, updater: (prev: Chat, exist: boolean) => Chat) => {
            setChats((prev) => {
                const index = prev.findIndex((chat) => chat.id === chatId);
                if (index === -1) {
                    return [
                        ...prev,
                        updater({ id: chatId, scope, history: [] }, false),
                    ];
                }
                const nextChats = [...prev];
                nextChats[index] = updater(prev[index], true);
                return nextChats;
            });
        },
        [scope, setChats],
    );

    const send = useCallback(
        async (nextInput?: Input) => {
            const payload = nextInput ?? input;
            const text = payload.text.trim();
            if (payload.assets.length === 0 && text.length === 0) {
                return;
            }

            const prevChat: Chat = currentChat ?? {
                id: createChatId(),
                scope,
                history: [],
            };
            const session = createSession({
                history: prevChat.history,
                ...runtime,
                configId: selectedConfigId,
            });
            setInput(EMPTY_INPUT);

            const settle = () =>
                updateChat(prevChat.id, (prev) => ({
                    ...prev,
                    pending: false,
                    abortController: undefined,
                }));

            const request = session({
                message: text,
                assets: payload.assets,
            });
            activeRequestsRef.current.add(request);
            try {
                updateChat(prevChat.id, (prev, exist) => {
                    if (!exist) {
                        Promise.resolve().then(() =>
                            setCurrentChatId(prevChat.id),
                        );
                    }
                    return { ...prev, pending: true, abortController: request };
                });

                const stream = await request;
                for await (const chunk of stream) {
                    updateChat(prevChat.id, (prev) => ({
                        ...prev,
                        history: normalizeHistory(chunk.history),
                    }));
                }
                settle();
            } catch (error) {
                settle();
                if (isAbortError(error)) {
                    return;
                }
                const message =
                    error instanceof Error ? error.message : String(error);
                toast.error(message);
            } finally {
                activeRequestsRef.current.delete(request);
            }
        },
        [input, currentChat, runtime, scope, selectedConfigId, updateChat],
    );

    const abortCurrentChat = useCallback(() => {
        if (!currentChatId) {
            return;
        }
        const chat = scopedChats.find((item) => item.id === currentChatId);
        chat?.abortController?.abort();
        updateChat(currentChatId, (prev) => ({
            ...prev,
            pending: false,
            abortController: undefined,
        }));
    }, [currentChatId, scopedChats, updateChat]);

    const rerunToolCall = useCallback(
        async (messageIndex: number) => {
            const chat = scopedChats.find((item) => item.id === currentChatId);
            if (!chat) {
                return;
            }
            const session = createSession({
                history: chat.history,
                ...runtime,
                configId: selectedConfigId,
            });
            try {
                await session.rerunToolCall(messageIndex);
            } catch (error) {
                toast.error(
                    error instanceof Error ? error.message : String(error),
                );
            }
        },
        [scopedChats, currentChatId, runtime, selectedConfigId],
    );

    const ctx = useMemo(
        () => ({
            input,
            setInput,
            chats: scopedChats,
            setChats,
            currentChatId,
            setCurrentChatId,
            runtime,
            selectedConfigId,
            setSelectedConfigId,
            canSend,
            send,
            abortCurrentChat,
            rerunToolCall,
        }),
        [
            input,
            scopedChats,
            setChats,
            currentChatId,
            runtime,
            selectedConfigId,
            setSelectedConfigId,
            canSend,
            send,
            abortCurrentChat,
            rerunToolCall,
        ],
    );

    // Root 只提供 context（不包裹布局 div），以便宿主以 compound 方式把按钮、
    // 弹层等任意子节点放进 Root 而不被额外的全尺寸容器影响布局。聊天界面的
    // 背景与尺寸由 Content 自身承载。
    return (
        <I18nProvider locale={runtime.locale}>
            <AssistantContext.Provider value={ctx}>
                {children}
            </AssistantContext.Provider>
        </I18nProvider>
    );
}

function ModelSwitcher() {
    const { runtime, selectedConfigId, setSelectedConfigId } =
        useAssistantContext();
    const { t } = useI18n();
    const [open, setOpen] = useState(false);

    if (runtime.configs.length === 0) {
        return null;
    }

    const currentConfig = runtime.configs.find(
        (config) => config.id === selectedConfigId,
    );
    const label = currentConfig?.name ?? t("switchModel");

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    title={label}
                    className="inline-flex h-8 max-w-[160px] cursor-pointer items-center gap-1 rounded-full px-2 text-xs text-foreground/70 hover:bg-muted hover:text-foreground"
                >
                    <span className="truncate">{label}</span>
                    <i className="icon-[mdi--unfold-more-horizontal] size-3.5 flex-shrink-0 opacity-70"></i>
                </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start" side="top">
                <div className="max-h-72 overflow-y-auto">
                    {runtime.configs.map((config) => (
                        <button
                            type="button"
                            key={config.id}
                            onClick={() => {
                                setSelectedConfigId(config.id);
                                setOpen(false);
                            }}
                            className={`group flex w-full items-center gap-2 rounded-sm px-2 py-1 text-sm hover:bg-accent ${
                                config.id === selectedConfigId
                                    ? "bg-accent"
                                    : ""
                            }`}
                        >
                            <span className="min-w-0 flex-1 truncate text-left">
                                {config.name}
                            </span>
                            {config.id === selectedConfigId && (
                                <i className="icon-[mdi--check] size-4"></i>
                            )}
                        </button>
                    ))}
                </div>
            </PopoverContent>
        </Popover>
    );
}

function Actions() {
    const { chats, setChats, currentChatId, setCurrentChatId } =
        useAssistantContext();
    const { t } = useI18n();
    const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

    return (
        <div className="flex items-center">
            <Button variant="ghost" onClick={() => setCurrentChatId(undefined)}>
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
                <PopoverContent className="w-56 p-1" align="end">
                    <div className="max-h-72 overflow-y-auto">
                        {chats.length === 0 && (
                            <div className="px-2 py-3 text-sm opacity-70 text-center">
                                {t("noChats")}
                            </div>
                        )}
                        {chats.map((chat) => {
                            const title =
                                chat.history.find(
                                    (message): message is AssistantMessage =>
                                        message.role === "assistant" &&
                                        Boolean(message.formatted.overview),
                                )?.formatted.overview ?? t("newChat");
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
                                        className="min-w-0 flex-1 flex items-center gap-2 text-left !outline-none"
                                    >
                                        <span className="truncate">
                                            {title}
                                        </span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={(event) => {
                                            event.preventDefault();
                                            event.stopPropagation();
                                            setChats((prev) =>
                                                prev.filter(
                                                    (item) =>
                                                        item.id !== chat.id,
                                                ),
                                            );
                                            if (currentChatId === chat.id) {
                                                setCurrentChatId(undefined);
                                            }
                                        }}
                                        className="rounded-sm p-1 opacity-60 hover:opacity-100 hover:bg-accent text-foreground/80 flex justify-center items-center"
                                        aria-label={t("deleteChat")}
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

function Content({ hideHeader }: { hideHeader?: boolean } = {}) {
    const {
        input,
        setInput,
        send,
        abortCurrentChat,
        rerunToolCall,
        canSend,
        chats,
        currentChatId,
        runtime,
    } = useAssistantContext();
    const { t } = useI18n();
    const currentChat = chats.find((chat) => chat.id === currentChatId);
    const isPending = Boolean(currentChat?.pending);
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const sendRef = useRef(send);
    sendRef.current = send;

    useEffect(() => {
        if (currentChat?.history.length && currentChatId) {
            messagesContainerRef.current?.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: "smooth",
            });
        }
    }, [currentChat?.history.length, currentChatId]);

    return (
        <div className="chaty-root w-full h-full flex flex-col overflow-hidden relative bg-background text-foreground">
            {!hideHeader && (
                <div className="flex justify-center items-center py-2 h-12">
                    <div>{runtime.title ?? t("appTitle")}</div>
                    <div className="absolute right-2">
                        <Actions />
                    </div>
                </div>
            )}
            <div
                ref={messagesContainerRef}
                className="w-full flex-1 flex flex-col gap-4 overflow-y-auto px-2 pt-2 pb-[170px] text-sm"
            >
                {currentChat ? (
                    // 不过滤 system 消息：MessageBubble 对 system 渲染为 null，
                    // 同时保持 index 与会话历史下标一致（rerunToolCall 依赖真实下标）。
                    currentChat.history.map((message, index) => (
                        <MessageBubble
                            key={message.id}
                            message={message}
                            onRerunToolCall={() => rerunToolCall(index)}
                        />
                    ))
                ) : (
                    <div className="w-full h-full flex flex-col gap-4 justify-center items-center">
                        <i className="icon-[mdi--shimmer-outline] size-12 text-lg bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600"></i>
                        {runtime.emptyStateSlogan ?? t("emptyState")}
                    </div>
                )}
            </div>
            <div
                aria-hidden="true"
                className="pointer-events-none absolute left-0 right-0 bottom-[-10px] h-[150px] bg-gradient-to-b from-transparent via-background/70 to-background/95 backdrop-blur-[2px] [mask-image:linear-gradient(to_bottom,transparent,black_40%)]"
            />
            <div className="w-full absolute left-0 bottom-0 px-2 py-4 flex flex-col gap-2">
                {runtime.presetPrompts?.length ? (
                    <div className="w-full flex overflow-x-auto scrollbar-hidden gap-2">
                        {runtime.presetPrompts.map((presetPrompt) => (
                            <button
                                key={presetPrompt.id}
                                type="button"
                                onClick={async () => {
                                    if (!isPending) {
                                        const nextInput = {
                                            ...input,
                                            text: presetPrompt.prompt,
                                        };
                                        setInput((value) => ({
                                            ...value,
                                            text: presetPrompt.prompt,
                                        }));
                                        sendRef.current(nextInput);
                                    }
                                }}
                                className="rounded-full border shadow py-1 px-2 text-xs hover:bg-muted cursor-pointer bg-background flex-shrink-0"
                            >
                                {presetPrompt.label}
                            </button>
                        ))}
                    </div>
                ) : null}
                <div className="rounded-2xl w-full border shadow p-1 flex flex-col gap-2 bg-background">
                    {input.assets.length > 0 && (
                        <div className="flex gap-2 px-2 overflow-x-auto scrollbar-hidden">
                            {input.assets.map((file, index) => (
                                <div
                                    key={`${file.name}-${index}`}
                                    className="flex-shrink-0 bg-muted rounded p-2 text-xs flex items-center gap-2"
                                >
                                    <i className="icon-[mdi--file-outline] size-4"></i>
                                    <span className="max-w-24 truncate">
                                        {file.name}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setInput((value) => ({
                                                ...value,
                                                assets: value.assets.filter(
                                                    (_, itemIndex) =>
                                                        itemIndex !== index,
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
                        onChange={(event) => {
                            setInput((value) => ({
                                ...value,
                                text: event.target.value,
                            }));
                        }}
                        onKeyDown={(event) => {
                            if (event.nativeEvent.isComposing) {
                                return;
                            }
                            if (
                                event.key === "Enter" &&
                                !event.shiftKey &&
                                !event.metaKey &&
                                !event.ctrlKey
                            ) {
                                event.preventDefault();
                                if (canSend) {
                                    send();
                                }
                            }
                        }}
                        className="w-full h-10 p-2 resize-none !outline-none text-sm bg-transparent"
                    />
                    <div className="flex justify-between items-center">
                        <div className="flex min-w-0 items-center gap-1">
                            <Button
                                variant="ghost"
                                className="rounded-full p-0 w-8 h-8"
                                onClick={async () => {
                                    if (input.assets.length >= 3) {
                                        toast.error(t("uploadLimit"));
                                        return;
                                    }
                                    const files = await showFilePicker({
                                        multiple: true,
                                    });
                                    const remaining = 3 - input.assets.length;
                                    setInput((value) => ({
                                        ...value,
                                        assets: [
                                            ...value.assets,
                                            ...files.slice(0, remaining),
                                        ],
                                    }));
                                }}
                            >
                                <i className="icon-[mdi--plus] size-5"></i>
                            </Button>
                            <ModelSwitcher />
                        </div>
                        {isPending ? (
                            <Button
                                variant="ghost"
                                className="rounded-full p-0 w-8 h-8 bg-destructive hover:bg-destructive/80 text-destructive-foreground"
                                onClick={abortCurrentChat}
                                aria-label={t("stopResponse")}
                            >
                                <i className="icon-[mdi--stop] size-4"></i>
                            </Button>
                        ) : (
                            <Button
                                variant="ghost"
                                className="rounded-full p-0 w-8 h-8 bg-foreground/10 hover:bg-foreground/40"
                                disabled={!canSend}
                                onClick={() => send()}
                                aria-label={t("sendMessage")}
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

const MainAssistant = {
    Root,
    Content,
    Actions,
};

export default MainAssistant;
