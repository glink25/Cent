import { Collapsible } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PaginationIndicator } from "../indicator";
import { createChatBox, type EnvArg, getEnvPrompt } from "./chat";
import { ChatCard, type ChatCardData } from "./chat-card";

export function Assistant({ env }: { env?: EnvArg }) {
    const envPrompt = useMemo(() => getEnvPrompt(env), [env]);
    const envPromptRef = useRef(envPrompt);
    envPromptRef.current = envPrompt;

    const [cards, setCards] = useState<ChatCardData[]>([]);
    const [activeCardId, setActiveCardId] = useState<string | null>("default");
    const [isCollapsed, setIsCollapsed] = useState(false);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 当没有卡片时，创建一个默认的空卡片用于显示
    const displayCards = useMemo(() => {
        if (cards.length === 0) {
            return [
                {
                    id: "default",
                    messages: [],
                    input: "",
                    isLoading: false,
                    next: undefined,
                } as ChatCardData,
            ];
        }
        return cards;
    }, [cards]);

    // 跟踪需要初始化的卡片 ID（不包括默认卡片，默认卡片在发送消息时初始化）
    const cardsToInitIds = useMemo(
        () =>
            cards.filter((c) => !c.next && c.id !== "default").map((c) => c.id),
        [cards],
    );

    // 初始化聊天框（不包括默认卡片）
    useEffect(() => {
        const initializeChatBox = async () => {
            if (cardsToInitIds.length === 0) return;

            for (const cardId of cardsToInitIds) {
                try {
                    const next = await createChatBox(envPromptRef.current);
                    setCards((prev) =>
                        prev.map((c) => (c.id === cardId ? { ...c, next } : c)),
                    );
                } catch (error) {
                    console.error("Failed to initialize chat box:", error);
                }
            }
        };
        initializeChatBox();
    }, [cardsToInitIds]);

    const handleSendMessage = async (cardId: string, message: string) => {
        // 如果是默认卡片且还没有初始化，先初始化并创建实际的卡片
        if (cardId === "default" && cards.length === 0) {
            const newId = String(Date.now());
            try {
                const next = await createChatBox(envPromptRef.current);
                const newCard: ChatCardData = {
                    id: newId,
                    messages: [{ role: "user", content: message }],
                    input: "",
                    isLoading: true,
                    next,
                };
                setCards([newCard]);
                setActiveCardId(newId);
                // 发送消息
                const response = await next(message);
                setCards((prev) =>
                    prev.map((c) =>
                        c.id === newId
                            ? {
                                  ...c,
                                  isLoading: false,
                                  messages: [
                                      ...c.messages,
                                      { role: "assistant", content: response },
                                  ],
                              }
                            : c,
                    ),
                );
            } catch (error) {
                const errorCard: ChatCardData = {
                    id: newId,
                    messages: [
                        { role: "user", content: message },
                        {
                            role: "assistant",
                            content: `错误: ${
                                error instanceof Error
                                    ? error.message
                                    : String(error)
                            }`,
                        },
                    ],
                    input: "",
                    isLoading: false,
                    next: undefined,
                };
                setCards([errorCard]);
                setActiveCardId(newId);
            }
            return;
        }

        const card = cards.find((c) => c.id === cardId);
        if (!card || !card.next || card.isLoading) {
            return;
        }

        setCards((prev) =>
            prev.map((c) =>
                c.id === cardId
                    ? {
                          ...c,
                          input: "",
                          isLoading: true,
                          messages: [
                              ...c.messages,
                              { role: "user", content: message },
                          ],
                      }
                    : c,
            ),
        );

        try {
            const response = await card.next(message);
            setCards((prev) =>
                prev.map((c) =>
                    c.id === cardId
                        ? {
                              ...c,
                              isLoading: false,
                              messages: [
                                  ...c.messages,
                                  { role: "assistant", content: response },
                              ],
                          }
                        : c,
                ),
            );
        } catch (error) {
            setCards((prev) =>
                prev.map((c) =>
                    c.id === cardId
                        ? {
                              ...c,
                              isLoading: false,
                              messages: [
                                  ...c.messages,
                                  {
                                      role: "assistant",
                                      content: `错误: ${
                                          error instanceof Error
                                              ? error.message
                                              : String(error)
                                      }`,
                                  },
                              ],
                          }
                        : c,
                ),
            );
        }
    };

    const handleNewChat = async () => {
        const newId = String(Date.now());
        const next = await createChatBox(envPromptRef.current);
        const newCard: ChatCardData = {
            id: newId,
            messages: [],
            input: "",
            isLoading: false,
            next,
        };
        setCards((prev) => [newCard, ...prev]);
        setActiveCardId(newId);
        // 滚动到第一个 card
        setTimeout(() => {
            if (scrollContainerRef.current) {
                scrollContainerRef.current.scrollTo({
                    left: 0,
                    behavior: "smooth",
                });
            }
        }, 0);
    };

    const handleInputChange = (cardId: string, value: string) => {
        setCards((prev) =>
            prev.map((c) => (c.id === cardId ? { ...c, input: value } : c)),
        );
    };

    return (
        <Collapsible.Root
            open={!isCollapsed}
            onOpenChange={(open) => setIsCollapsed(!open)}
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
                            onClick={handleNewChat}
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
                        {displayCards.map((card) => (
                            <ChatCard
                                key={card.id}
                                card={card}
                                isActive={card.id === activeCardId}
                                onActivate={() => setActiveCardId(card.id)}
                                onSendMessage={(message) =>
                                    handleSendMessage(card.id, message)
                                }
                                onInputChange={(value) =>
                                    handleInputChange(card.id, value)
                                }
                            />
                        ))}
                    </div>

                    <PaginationIndicator
                        count={displayCards.length}
                        current={-1}
                        // current={displayCards.findIndex((v) => v.id === activeCardId)}
                    />
                </div>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
