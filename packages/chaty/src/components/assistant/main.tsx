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
    type ApproveChange,
    type ChangeProposal,
    type ChangeReceipt,
    type ConversationReference,
    createSession,
    type History,
} from "../../assistant";
import { mergeReferences } from "../../assistant/references";
import { showFilePicker } from "../file-picker";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { conversationTitle, hasCurrentResponse } from "./conversation";
import { I18nProvider, useI18n } from "./i18n";
import type { RuntimeConfig } from "./runtime";
import { type Chat, useAssistantChatStore } from "./state";
import { applyThemePreference } from "./theme";
import { changeReceiptFrom } from "./turn-model";
import { ConversationTurns } from "./turns";

type Input = {
    text: string;
    assets: File[];
    references?: ConversationReference[];
};

type AssistantContext = {
    input: Input;
    approval?: {
        proposal: ChangeProposal;
        call?: { id: string; name: string };
        decide: (approved: boolean, remember?: boolean) => void;
    };
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
    references,
    onReferencesConsumed,
}: {
    children?: ReactNode;
    runtime: RuntimeConfig;
    /** 受控的模型选择。传入时由宿主托管（如 cent 写回 ledger）；不传则内部管理。 */
    selectedConfigId?: string;
    onConfigChange?: (configId: string) => void;
    references?: ConversationReference[];
    onReferencesConsumed?: () => void;
}) {
    const [approval, setApproval] = useState<AssistantContext["approval"]>();
    const approveChange = useCallback<ApproveChange>(
        (proposal, signal, call) =>
            new Promise((resolve) => {
                const decide = (approved: boolean, remember?: boolean) => {
                    clearTimeout(timeout);
                    signal?.removeEventListener("abort", cancel);
                    setApproval((current) =>
                        current?.proposal.id === proposal.id
                            ? undefined
                            : current,
                    );
                    resolve({ approved, remember });
                };
                const cancel = () => decide(false);
                const timeout = setTimeout(cancel, 120_000);
                if (signal?.aborted) cancel();
                else {
                    signal?.addEventListener("abort", cancel, { once: true });
                    setApproval({ proposal, decide, call });
                }
            }),
        [],
    );
    const [input, setInput] = useState<Input>(EMPTY_INPUT);
    const [currentChatId, setCurrentChatId] = useState<Chat["id"]>();
    const sendingRef = useRef(false);
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

    useEffect(() => {
        if (!references?.length) return;
        setInput((value) => ({
            ...value,
            references: mergeReferences([
                ...(value.references ?? []),
                ...references,
            ]),
        }));
        onReferencesConsumed?.();
    }, [references, onReferencesConsumed]);

    const currentChat = scopedChats.find((chat) => chat.id === currentChatId);
    const canSend =
        !currentChat?.pending &&
        Boolean(
            input.assets.length > 0 ||
                input.references?.length ||
                input.text.trim().length > 0,
        );

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
            if (sendingRef.current || currentChat?.pending) return;
            const payload = nextInput ?? input;
            const text = payload.text.trim();
            if (
                !payload.assets.length &&
                !payload.references?.length &&
                !text
            ) {
                return;
            }

            const prevChat: Chat = currentChat ?? {
                id: createChatId(),
                scope,
                history: [],
            };
            const session = createSession({
                history: prevChat.history,
                contextState: prevChat.contextState,
                ...runtime,
                configId: selectedConfigId,
                approveChange: (proposal, signal, call) => {
                    setCurrentChatId(prevChat.id);
                    return approveChange(proposal, signal, call);
                },
            });
            sendingRef.current = true;
            setInput(payload);
            let accepted = false;
            let deferredNotified = false;
            const turnStarted = Date.now();

            const settle = (
                turnStatus: "completed" | "failed" | "cancelled" = "completed",
            ) =>
                updateChat(prevChat.id, (prev) => ({
                    ...prev,
                    pending: false,
                    awaitingResponse: false,
                    contextStatus: undefined,
                    pendingContextEvent: undefined,
                    history: prev.history.map((message, index) =>
                        accepted &&
                        index ===
                            prev.history.findLastIndex((m) => m.role === "user")
                            ? {
                                  ...message,
                                  elapsedMs: Date.now() - turnStarted,
                                  turnStatus,
                              }
                            : message,
                    ),
                    activity: undefined,
                    turnStartedAt: undefined,
                    activeTool: undefined,
                    abortController: undefined,
                }));

            const request = session({
                message: text,
                assets: payload.assets,
                references: payload.references,
            });
            activeRequestsRef.current.add(request);
            try {
                updateChat(prevChat.id, (prev, exist) => {
                    if (!exist) {
                        Promise.resolve().then(() =>
                            setCurrentChatId(prevChat.id),
                        );
                    }
                    return {
                        ...prev,
                        pending: true,
                        awaitingResponse: true,
                        turnStartedAt: turnStarted,
                        abortController: request,
                    };
                });

                const stream = await request;
                for await (const chunk of stream) {
                    if (chunk.contextStatus === "compacting")
                        deferredNotified = false;
                    if (
                        chunk.contextStatus === "deferred" &&
                        !deferredNotified
                    ) {
                        deferredNotified = true;
                        toast.info(
                            runtime.locale === "zh"
                                ? "暂未能整理较早对话，继续使用原始上下文。"
                                : "Could not summarize; continuing with the original context.",
                        );
                    }
                    if (!accepted && hasCurrentResponse(chunk.history)) {
                        accepted = true;
                        setInput((value) => ({
                            ...EMPTY_INPUT,
                            references: value.references?.filter(
                                (ref) =>
                                    !payload.references?.some(
                                        (sent) =>
                                            sent.id === ref.id &&
                                            sent.type === ref.type,
                                    ),
                            ),
                        }));
                    }
                    updateChat(prevChat.id, (prev) => ({
                        ...prev,
                        history: accepted
                            ? normalizeHistory(chunk.history)
                            : prev.history,
                        activeTool: chunk.activeTool,
                        activity: chunk.activity,
                        contextState: chunk.contextState,
                        pendingContextEvent:
                            chunk.contextStatus === "compacting"
                                ? chunk.contextEvent
                                : undefined,
                        contextEvents:
                            chunk.contextEvent?.summary &&
                            !prev.contextEvents?.some(
                                (event) => event.id === chunk.contextEvent?.id,
                            )
                                ? [
                                      ...(prev.contextEvents ??
                                          (prev.contextState &&
                                          prev.contextState !==
                                              chunk.contextState
                                              ? [
                                                    {
                                                        id: `legacy-${prev.contextState.coveredThroughId}`,
                                                        anchorId:
                                                            prev.contextState
                                                                .coveredThroughId,
                                                        summary:
                                                            prev.contextState
                                                                .summary,
                                                    },
                                                ]
                                              : [])),
                                      chunk.contextEvent,
                                  ]
                                : prev.contextEvents,
                        contextStatus: chunk.contextStatus,
                        contextMetrics: chunk.contextMetrics,
                        awaitingResponse: !accepted,
                    }));
                }
                settle();
            } catch (error) {
                settle(isAbortError(error) ? "cancelled" : "failed");
                if (isAbortError(error)) {
                    toast.info(
                        runtime.locale === "zh"
                            ? "已停止。已经完成的操作不会自动撤销。"
                            : "Stopped. Completed operations have not been undone.",
                    );
                    return;
                }
                const message =
                    error instanceof Error ? error.message : String(error);
                toast.error(message);
            } finally {
                sendingRef.current = false;
                activeRequestsRef.current.delete(request);
            }
        },
        [
            input,
            currentChat,
            runtime,
            scope,
            selectedConfigId,
            updateChat,
            approveChange,
        ],
    );

    const abortCurrentChat = useCallback(() => {
        if (!currentChatId) {
            return;
        }
        const chat = scopedChats.find((item) => item.id === currentChatId);
        chat?.abortController?.abort();
    }, [currentChatId, scopedChats]);

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
            approval,
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
            approval,
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
    const { approval, chats, setChats, currentChatId, setCurrentChatId } =
        useAssistantContext();
    const { t } = useI18n();
    const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

    return (
        <div className="flex items-center">
            <Button
                variant="ghost"
                disabled={!!approval}
                onClick={() => setCurrentChatId(undefined)}
            >
                <i className="icon-[mdi--comment-add-outline] size-5"></i>
            </Button>
            <Popover open={isChatMenuOpen} onOpenChange={setIsChatMenuOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="ghost"
                        disabled={!!approval}
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
                            const title = conversationTitle(
                                chat.history,
                                t("newChat"),
                            );
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
        approval,
        input,
        setInput,
        send,
        abortCurrentChat,
        canSend,
        chats,
        setChats,
        currentChatId,
        runtime,
    } = useAssistantContext();
    const { t } = useI18n();
    const currentChat = chats.find((chat) => chat.id === currentChatId);
    const isPending = Boolean(currentChat?.pending);
    async function undo(receipt: ChangeReceipt) {
        try {
            if (receipt.undo === "agent") {
                sendRef.current({
                    text: `Undo change ${receipt.proposal.id}: ${receipt.proposal.title}`,
                    assets: [],
                });
                return;
            }
            const result = await runtime.undoChange?.(receipt.proposal.id);
            if (result?.status !== "undone") {
                if (result) toast.error(result.status);
                return;
            }
            setChats((chats) =>
                chats.map((chat) =>
                    chat.id !== currentChatId
                        ? chat
                        : {
                              ...chat,
                              history: chat.history.map((entry) => {
                                  if (entry.role !== "tool") return entry;
                                  const previous = changeReceiptFrom(
                                      entry.formatted.returns,
                                  );
                                  if (
                                      previous?.proposal.id !==
                                      receipt.proposal.id
                                  )
                                      return entry;
                                  const returns =
                                      previous === entry.formatted.returns
                                          ? result
                                          : {
                                                ...(entry.formatted
                                                    .returns as object),
                                                change: result,
                                            };
                                  return {
                                      ...entry,
                                      formatted: {
                                          ...entry.formatted,
                                          returns,
                                      },
                                  };
                              }),
                          },
                ),
            );
        } catch (error) {
            toast.error(error instanceof Error ? error.message : String(error));
        }
    }
    const messagesContainerRef = useRef<HTMLDivElement>(null);
    const followLatest = useRef(true);
    const [showLatest, setShowLatest] = useState(false);
    const sendRef = useRef(send);
    sendRef.current = send;

    useEffect(() => {
        if (!currentChatId) return;
        followLatest.current = true;
        setShowLatest(false);
        const element = messagesContainerRef.current;
        if (element) element.scrollTop = element.scrollHeight;
    }, [currentChatId]);

    useEffect(() => {
        if (
            currentChat?.history.length &&
            currentChatId &&
            followLatest.current
        ) {
            messagesContainerRef.current?.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: "instant",
            });
        }
    }, [currentChat?.history, currentChatId]);

    return (
        <div className="chaty-root isolate w-full h-full min-h-0 flex-1 flex flex-col overflow-hidden relative bg-background text-foreground">
            {!hideHeader && (
                <header className="relative z-10 shrink-0 flex justify-center items-center py-2 h-12 bg-background">
                    <div>{runtime.title ?? t("appTitle")}</div>
                    <div className="absolute right-2">
                        <Actions />
                    </div>
                </header>
            )}
            <div
                ref={messagesContainerRef}
                onScroll={(event) => {
                    const el = event.currentTarget;
                    followLatest.current =
                        el.scrollHeight - el.scrollTop - el.clientHeight < 100;
                    setShowLatest(!followLatest.current);
                }}
                className="w-full flex-1 flex flex-col gap-4 overflow-y-auto px-2 py-2 min-h-0 text-sm"
            >
                {currentChat ? (
                    <ConversationTurns
                        history={currentChat.history}
                        approval={approval}
                        undo={undo}
                        undoDisabled={isPending}
                        contextEvents={
                            currentChat.contextEvents ??
                            (currentChat.contextState
                                ? [
                                      {
                                          id: `legacy-${currentChat.contextState.coveredThroughId}`,
                                          anchorId:
                                              currentChat.contextState
                                                  .coveredThroughId,
                                          summary:
                                              currentChat.contextState.summary,
                                      },
                                  ]
                                : [])
                        }
                        pendingContextEvent={currentChat.pendingContextEvent}
                        pending={isPending && !currentChat.awaitingResponse}
                        activeTool={currentChat.activeTool}
                        activity={currentChat.activity}
                        tools={runtime.tools}
                        startedAt={currentChat.turnStartedAt}
                        contextStatus={currentChat.contextStatus}
                    />
                ) : (
                    <div className="w-full h-full flex flex-col gap-4 justify-center items-center">
                        <i className="icon-[mdi--shimmer-outline] size-12 text-lg bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600"></i>
                        {runtime.emptyStateSlogan ?? t("emptyState")}
                    </div>
                )}
            </div>
            {showLatest && (
                <div className="relative h-0 z-10">
                    <button
                        type="button"
                        aria-label={t("flowLatest")}
                        title={t("flowLatest")}
                        className="absolute bottom-3 left-1/2 -translate-x-1/2 grid size-9 place-items-center rounded-full border bg-background shadow"
                        onClick={() => {
                            followLatest.current = true;
                            setShowLatest(false);
                            messagesContainerRef.current?.scrollTo({
                                top: messagesContainerRef.current.scrollHeight,
                                behavior: "smooth",
                            });
                        }}
                    >
                        <i
                            aria-hidden="true"
                            className="icon-[mdi--arrow-down] size-5"
                        />
                    </button>
                </div>
            )}
            <div className="w-full shrink-0 px-2 py-3 flex flex-col gap-2">
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
                    {!!input.references?.length && (
                        <div className="flex gap-2 px-2 overflow-x-auto">
                            {input.references.map((ref) => (
                                <span
                                    key={JSON.stringify([ref.type, ref.id])}
                                    className="flex shrink-0 gap-2 items-center rounded bg-muted px-2 py-1 text-xs"
                                >
                                    <i className="icon-[mdi--link-variant] size-4" />
                                    {ref.label}
                                    <button
                                        type="button"
                                        disabled={isPending}
                                        aria-label={`× ${ref.label}`}
                                        onClick={() =>
                                            setInput((value) => ({
                                                ...value,
                                                references:
                                                    value.references?.filter(
                                                        (item) =>
                                                            item.id !==
                                                                ref.id ||
                                                            item.type !==
                                                                ref.type,
                                                    ),
                                            }))
                                        }
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                        </div>
                    )}
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
                                        disabled={isPending}
                                        className="hover:bg-accent rounded p-0.5"
                                    >
                                        <i className="icon-[mdi--close] size-3"></i>
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                    <textarea
                        aria-busy={isPending}
                        disabled={isPending}
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
                                disabled={isPending}
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
                            <fieldset disabled={isPending} className="min-w-0">
                                <ModelSwitcher />
                            </fieldset>
                        </div>
                        {isPending ? (
                            <Button
                                variant="ghost"
                                className="rounded-full p-0 w-8 h-8 bg-foreground/10"
                                onClick={abortCurrentChat}
                                aria-busy={currentChat?.awaitingResponse}
                                aria-label={t("stopResponse")}
                            >
                                <i
                                    className={
                                        !currentChat?.awaitingResponse
                                            ? "icon-[mdi--stop] size-4"
                                            : "icon-[mdi--loading] size-4 animate-spin"
                                    }
                                ></i>
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
