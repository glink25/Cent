import { Collapsible } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type PersistedChatCard, useAssistantStore } from "@/store/assistant";
import { PaginationIndicator } from "../indicator";
import {
    type ChatBox,
    createChatBox,
    type EnvArg,
    getEnvPrompt,
    type Message,
} from "./chat";
import { ChatCard, type ChatCardData } from "./chat-card";

type CardData = { messages: Message[]; id: string; loading: boolean };

export function Assistant({ env }: { env?: EnvArg }) {
    const envPrompt = useMemo(() => getEnvPrompt(env), [env]);
    const envPromptRef = useRef(envPrompt);
    envPromptRef.current = envPrompt;

    // 从 store 读取持久化的数据

    const scrollContainerRef = useRef<HTMLDivElement>(null);

    const isCollapsed = useAssistantStore((state) => state.isCollapsed);

    const [cards, setCards] = useState<CardData[]>([]);

    const chatBoxes = useRef(new Map<string, ChatBox>());
    const handleSendMessage = async (id: string, message: string) => {
        const card = cards.find((v) => v.id === id);
        if (!card) {
            return;
        }
        const updateCard = (setter: (prev: CardData) => CardData) => {
            setCards((prev) => {
                const i = prev.findIndex((v) => v.id === id);
                if (i === -1) {
                    return prev;
                }
                prev[i] = setter({ ...prev[i] });
                return [...prev];
            });
        };
        const run = async () => {
            const chatBox = await (async () => {
                const exist = chatBoxes.current.get(id);
                if (exist) {
                    return exist;
                }
                const c = await createChatBox(
                    envPromptRef.current,
                    card.messages,
                );
                chatBoxes.current.set(id, c);
                return c;
            })();

            updateCard((prev) => ({
                ...prev,
                messages: [
                    ...prev.messages,
                    { role: "user", content: message },
                ],
            }));
            try {
                const result = await chatBox.next(message);
                updateCard((prev) => ({
                    ...prev,
                    messages: [
                        ...prev.messages,
                        { role: "assistant", content: result },
                    ],
                }));
            } catch (error) {
                console.error(error);
                updateCard((prev) => ({
                    ...prev,
                    messages: [
                        ...prev.messages,
                        {
                            role: "assistant",
                            content: `错误：${error instanceof Error ? error.message : String(error)}`,
                        },
                    ],
                }));
                throw error;
            }
        };
        updateCard((prev) => ({ ...prev, loading: true }));
        try {
            await run();
        } finally {
            updateCard((prev) => ({ ...prev, loading: false }));
        }
    };

    const handleDeleteCard = (id: string) => {};

    const addNewCard = () => {};

    return (
        <Collapsible.Root
            open={!isCollapsed}
            onOpenChange={(open) => {
                useAssistantStore.setState((prev) => ({
                    ...prev,
                    isCollapsed: !open,
                }));
            }}
            className="w-full rounded-md border group"
        >
            {/* 标题栏 */}
            <div className="flex items-center justify-between p-2 border-b">
                <div className="flex items-center gap-2">
                    <i className="icon-[mdi--robot] text-lg"></i>
                    <span className="text-sm font-medium">AI 助手</span>
                </div>
                <div className="flex items-center gap-2">
                    {cards.length > 0 && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={addNewCard}
                            className="h-7 text-xs group-data-[state=closed]:hidden"
                        >
                            <i className="icon-[mdi--plus] mr-1"></i>
                            新对话
                        </Button>
                    )}
                    <Collapsible.Trigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 group">
                            <i className="group-[[data-state=open]]:icon-[mdi--chevron-down] group-[[data-state=closed]]:icon-[mdi--chevron-up]"></i>
                        </Button>
                    </Collapsible.Trigger>
                </div>
            </div>

            {/* 折叠内容 */}
            <Collapsible.Content className="data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
                <div className="w-full pb-2">
                    <div
                        ref={scrollContainerRef}
                        className="overflow-x-auto w-full h-[300px] flex-shrink-0 py-2 flex gap-2 scrollbar-hidden snap-mandatory snap-x"
                    >
                        {cards.map((card) => (
                            <div
                                key={card.id}
                                className="w-full shrink-0 snap-center"
                            >
                                <ChatCard
                                    isLoading={card.loading}
                                    messages={card.messages}
                                    onSendMessage={(message) =>
                                        handleSendMessage(card.id, message)
                                    }
                                    onDelete={
                                        card.id !== "default" &&
                                        card.messages.length > 0
                                            ? () => handleDeleteCard(card.id)
                                            : undefined
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    <PaginationIndicator count={cards.length} current={-1} />
                </div>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
