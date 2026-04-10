import {
    createContext,
    type Dispatch,
    type ReactNode,
    type SetStateAction,
    useCallback,
    useContext,
    useMemo,
    useState,
} from "react";
import { toast } from "sonner";
import { v4 } from "uuid";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import { Button } from "../ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger } from "../ui/select";
import type { History } from "./core";
import { createContext as createChatContext } from "./core";
import { CentAITools } from "./tools";
import { CentAIProvider } from "./tools/provider";

type Input = { text: string; assets: File[] };

type Chat = {
    id: string;
    history: History;
};

type AssistantContext = {
    input: Input;
    setInput: Dispatch<SetStateAction<Input>>;
    chats: Chat[];
    currentChatId: Chat["id"] | undefined;
    setCurrentChatId: Dispatch<SetStateAction<Chat["id"] | undefined>>;
    canSend: boolean;
    send: () => void;
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
    const [chats, setChats] = useState<Chat[]>([]);

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
        [],
    );

    const currentChat = chats.find((c) => c.id === currentChatId);
    const canSend = true;
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
        const next = createChatContext({
            history: prevChat.history,
            provider: CentAIProvider,
            tools: CentAITools,
        });
        setInput({ text: "", assets: [] });

        try {
            const stream = await next({
                message: input.text,
                assets: input.assets,
            });
            for await (const chunk of stream) {
                console.log(chunk, "chunks");
                updateChat(prevChat.id, (prev, exist) => {
                    if (!exist) {
                        Promise.resolve().then(() => {
                            setCurrentChatId(prevChat.id);
                        });
                    }
                    return { ...prev, history: chunk.history };
                });
            }
        } catch (error) {
            console.error(error);
            const errorMsg =
                error instanceof Error ? error.message : JSON.stringify(error);
            toast.error(errorMsg);
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
        }),
        [input, chats, currentChatId, send],
    );
    return (
        <AssistantContext.Provider value={ctx}>
            {children}
        </AssistantContext.Provider>
    );
}

function Actions() {
    const { chats, currentChatId, setCurrentChatId } = useAssistantContext();

    return (
        <div className="flex items-center">
            <Button variant={"ghost"}>
                <i className="icon-[mdi--comment-edit-outline] size-5"></i>
            </Button>
            <Select value={currentChatId} onValueChange={setCurrentChatId}>
                {/* 新建聊天窗口，如果当前聊天窗口已经是新聊天了，则点击新建不会再次新建
                注意默认情况下，打开Assistant之后是一个新窗口状态，但是不应该直接创建新聊天记录，只有当用户点击发送之后才需要真的创建新的聊天记录 */}
                <SelectTrigger className="border-none shadow-none [&>svg]:hidden !text-foreground">
                    <i className="icon-[mdi--menu] size-5"></i>
                </SelectTrigger>
                {/* 历史聊天对话选择器，可以在这里切换聊天对话，注意切换对话后，之前的对话不会被终止，如果还在接收请求，需要有对应的标识（小圆点 */}
                <SelectContent>
                    {chats.length === 0 && (
                        <div className="text-sm opacity-70 text-center">
                            No Chats
                        </div>
                    )}
                    {chats.map((chat) => {
                        const title =
                            chat.history.findLast((v) => v.role === "assistant")
                                ?.formatted.overview ?? "untitled";
                        return (
                            <SelectItem key={chat.id} value={chat.id}>
                                {title}
                            </SelectItem>
                        );
                    })}
                </SelectContent>
            </Select>
        </div>
    );
}

function Content() {
    const t = useIntl();
    const { input, setInput, send, canSend, chats, currentChatId } =
        useAssistantContext();
    const currentChat = chats.find((c) => c.id === currentChatId);

    return (
        <div className="w-full flex-1 flex flex-col overflow-hidden relative">
            <div className="hidden md:flex justify-center items-center py-2 h-12">
                <div>{t("ai-assistant")}</div>
                <div className="absolute right-2">
                    <Actions />
                </div>
            </div>
            <div className="w-full flex-1 flex flex-col gap-4 overflow-y-auto px-2 py-2 pb-[200px] text-sm">
                {currentChat ? (
                    currentChat.history.map((message, i) => {
                        const id = i;
                        return (
                            <div
                                key={id}
                                className={cn(
                                    "flex",
                                    message.role === "user"
                                        ? "justify-end"
                                        : "justify-start",
                                )}
                            >
                                {message.role === "user" ? (
                                    <div className="border rounded-md p-2">
                                        {message.raw}
                                    </div>
                                ) : message.role === "tool" ? (
                                    <div className="rounded-md p-2 bg-muted text-xs">
                                        {message.raw}
                                    </div>
                                ) : (
                                    <div className="border rounded-md p-2 bg-muted">
                                        {message.raw}
                                    </div>
                                )}
                            </div>
                        );
                    })
                ) : (
                    <div className="w-full h-full flex justify-center items-center">
                        Type to ask
                    </div>
                )}
            </div>
            {/* 底部区域，用于展示消息输入框和提示 */}
            <div className="w-full absolute left-0 bottom-0 px-2 py-4 flex flex-col gap-2">
                <div className="w-full flex overflow-x-auto scrollbar-hidden">
                    <div className="rounded-full border shadow py-1 px-2 text-xs hover:bg-muted cursor-pointer bg-background">
                        帮我分析账单
                    </div>
                </div>
                {/* 消息输入窗口textarea，允许上传附件， 拥有与google gemini相似的发送按钮和界面*/}
                <div className="rounded-2xl w-full border shadow p-1 flex flex-col gap-2 bg-background">
                    <textarea
                        value={input.text}
                        onChange={(e) => {
                            setInput((v) => ({
                                ...v,
                                text: e.target.value,
                            }));
                        }}
                        className="w-full h-10 p-2 resize-none !outline-none"
                    ></textarea>
                    <div className="flex justify-between items-center">
                        <Button
                            variant={"ghost"}
                            className="rounded-full p-0 w-8 h-8"
                        >
                            <i className="icon-[mdi--plus] size-5"></i>
                        </Button>

                        <Button
                            variant={"ghost"}
                            className="rounded-full p-0 w-8 h-8 bg-foreground/10 hover:bg-foreground/40"
                            disabled={!canSend}
                            onClick={send}
                        >
                            <i className="icon-[mdi--send] size-4"></i>
                        </Button>
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
