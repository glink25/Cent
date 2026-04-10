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
import type {
    AbortablePromise,
    AssistantMessage,
    History,
    TurnResult,
} from "@/assistant";
import { createSession } from "@/assistant";
import { showFilePicker } from "@/components/file-picker";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { MessageBubble } from "./message";
import { useAssistantChatStore } from "./state";
import { CentAIConfig } from "./tools";

type Input = { text: string; assets: File[] };

type Chat = {
    id: string;
    history: History;
    pending?: boolean;
    abortController?: AbortablePromise<AsyncIterable<TurnResult>>;
};

type AssistantContext = {
    input: Input;
    setInput: Dispatch<SetStateAction<Input>>;
    chats: Chat[];
    currentChatId: Chat["id"] | undefined;
    setCurrentChatId: Dispatch<SetStateAction<Chat["id"] | undefined>>;
    canSend: boolean;
    send: () => void;
    abortCurrentChat: () => void;
};

const AssistantContext = createContext<AssistantContext | null>(null);

const useAssistantContext = () => {
    const ctx = useContext(AssistantContext);
    if (!ctx) {
        throw new Error("AssistantContext init failed");
    }
    return ctx;
};

function Root({ children }: { children?: ReactNode }) {
    const [input, setInput] = useState<Input>({ text: "", assets: [] });
    const [currentChatId, setCurrentChatId] = useState<Chat["id"]>();
    const chats = useAssistantChatStore((s) => s.chats);
    const setChats = useAssistantChatStore((s) => s.setChats); // 只有chats需要被持久化

    const updateChat = useCallback(
        (chatId: string, updater: (prev: Chat, exist: boolean) => Chat) => {
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
    const send = useCallback(async () => {
        if (input.assets.length === 0 && input.text.length === 0) {
            return;
        }
        const prevChat: Chat = (() => {
            if (currentChat === undefined) {
                return {
                    history: [],
                    id: v4(),
                };
            }
            return currentChat;
        })();
        const next = createSession({
            history: prevChat.history,
            ...CentAIConfig,
        });
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
            console.error(error);
            const errorMsg =
                error instanceof Error ? error.message : JSON.stringify(error);
            toast.error(errorMsg);

            updateChat(prevChat.id, (prev) => ({
                ...prev,
                pending: false,
                abortController: undefined,
            }));
        }
    }, [input, currentChat, updateChat]);

    const ctx = useMemo(
        () => ({
            input,
            setInput,
            chats,
            currentChatId,
            setCurrentChatId,
            canSend,
            send,
            abortCurrentChat,
        }),
        [input, chats, currentChatId, canSend, send, abortCurrentChat],
    );
    return (
        <AssistantContext.Provider value={ctx}>
            {children}
        </AssistantContext.Provider>
    );
}

function Actions() {
    const t = useIntl();
    const { chats, currentChatId, setCurrentChatId } = useAssistantContext();
    const setChats = useAssistantChatStore((s) => s.setChats);
    const [isChatMenuOpen, setIsChatMenuOpen] = useState(false);

    return (
        <div className="flex items-center">
            {/* 创建新会话按钮 */}
            <Button
                variant={"ghost"}
                onClick={() => {
                    setCurrentChatId(undefined);
                }}
            >
                <i className="icon-[mdi--comment-edit-outline] size-5"></i>
            </Button>
            {/* 会话切换 */}
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

function Content() {
    const t = useIntl();
    const {
        input,
        setInput,
        send,
        canSend,
        chats,
        currentChatId,
        abortCurrentChat,
    } = useAssistantContext();
    const currentChat = chats.find((c) => c.id === currentChatId);
    const messagesContainerRef = useRef<HTMLDivElement>(null);

    const PRESET_QUESTIONS = useMemo(
        () => [
            {
                label: t("preset_question.analyze_ledger.label"),
                prompt: t("preset_question.analyze_ledger.prompt"),
            },
            {
                label: t("preset_question.monthly_budget.label"),
                prompt: t("preset_question.monthly_budget.prompt"),
            },
            {
                label: t("preset_question.anomaly_detection.label"),
                prompt: t("preset_question.anomaly_detection.prompt"),
            },
            {
                label: t("preset_question.annual_summary.label"),
                prompt: t("preset_question.annual_summary.prompt"),
            },
        ],
        [t],
    );

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
            <div className="hidden md:flex justify-center items-center py-2 h-12">
                <div>{t("ai-assistant")}</div>
                <div className="absolute right-2">
                    <Actions />
                </div>
            </div>
            {/* ai回复时自动滚动到最底部，切换聊天记录、发送新消息时也需要滚动到最底部 */}
            <div
                ref={messagesContainerRef}
                className="w-full flex-1 flex flex-col gap-4 overflow-y-auto px-2 py-2 pb-[200px] text-sm"
            >
                {currentChat ? (
                    currentChat.history.map((message, i) => {
                        const id = i;
                        return <MessageBubble key={id} message={message} />;
                    })
                ) : (
                    <div className="w-full h-full flex flex-col gap-4 justify-center items-center">
                        <i className="icon-[mdi--shimmer-outline] size-12 text-lg bg-gradient-to-tr from-cyan-400 via-blue-500 to-purple-600"></i>
                        {t("start-talk-to-ai")}
                    </div>
                )}
            </div>
            {/* 底部区域，用于展示消息输入框和提示 */}
            <div className="w-full absolute left-0 bottom-0 px-2 py-4 flex flex-col gap-2">
                <div className="w-full flex overflow-x-auto scrollbar-hidden gap-2">
                    {PRESET_QUESTIONS.map((question, index) => (
                        <button
                            key={index}
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
                {/* 消息输入窗口textarea，允许上传附件， 拥有与google gemini相似的发送按钮和界面*/}
                <div className="rounded-2xl w-full border shadow p-1 flex flex-col gap-2 bg-background">
                    {/* 附件展示区域，一次消息最多支持3个附件 */}
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

                    {/* 消息输入区域 */}
                    <textarea
                        value={input.text}
                        onChange={(e) => {
                            setInput((v) => ({
                                ...v,
                                text: e.target.value,
                            }));
                        }}
                        onKeyDown={(e) => {
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
                        className="w-full h-10 p-2 resize-none !outline-none"
                    ></textarea>
                    <div className="flex justify-between items-center">
                        {/* 附件上传按钮 */}
                        <Button
                            variant="ghost"
                            className="rounded-full p-0 w-8 h-8"
                            onClick={async () => {
                                if (input.assets.length >= 3) {
                                    toast.error("最多上传3个附件");
                                    return;
                                }
                                const files = await showFilePicker({
                                    accept: "image/*,application/pdf,text/*,.csv,.xlsx,.json",
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

                        {/* 发送按钮，当前聊天窗口为pending时，改为中断按钮 */}
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

const MainAssistant = {
    Root,
    Content,
    Actions,
};

export default MainAssistant;
