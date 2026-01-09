import { Collapsible } from "radix-ui";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { type PersistedChatCard, useAssistantStore } from "@/store/assistant";
import { PaginationIndicator } from "../indicator";
import { createChatBox, type EnvArg, getEnvPrompt } from "./chat";
import { ChatCard, type ChatCardData } from "./chat-card";

export function Assistant({ env }: { env?: EnvArg }) {
    const envPrompt = useMemo(() => getEnvPrompt(env), [env]);
    const envPromptRef = useRef(envPrompt);
    envPromptRef.current = envPrompt;

    // 从 store 读取持久化的数据
    const persistedCards = useAssistantStore((state) => state.cards);
    const activeCardId = useAssistantStore((state) => state.activeCardId);
    const isCollapsed = useAssistantStore((state) => state.isCollapsed);
    const setActiveCardId = useAssistantStore((state) => state.setActiveCardId);
    const setIsCollapsed = useAssistantStore((state) => state.setIsCollapsed);
    const addPersistedCard = useAssistantStore((state) => state.addCard);
    const updatePersistedCard = useAssistantStore((state) => state.updateCard);
    const removePersistedCard = useAssistantStore((state) => state.removeCard);

    // 本地状态：包含 next 函数和 isLoading 的完整卡片数据
    const [localCards, setLocalCards] = useState<
        Map<
            string,
            { next?: (message: string) => Promise<string>; isLoading: boolean }
        >
    >(new Map());

    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const initializedRef = useRef(false);
    const cardRefs = useRef<Map<string, HTMLDivElement>>(new Map());
    const [visibleCardId, setVisibleCardId] = useState<string | null>(null);

    // 从持久化数据恢复本地状态（只在组件挂载时执行一次）
    // 过滤掉 messages 为空的卡片（不应该存在，但为了健壮性还是过滤）
    useEffect(() => {
        if (initializedRef.current) return;
        initializedRef.current = true;

        const newLocalCards = new Map<
            string,
            { next?: (message: string) => Promise<string>; isLoading: boolean }
        >();
        persistedCards
            .filter((card) => card.messages.length > 0)
            .forEach((card) => {
                newLocalCards.set(card.id, { isLoading: false });
            });
        setLocalCards(newLocalCards);
    }, [persistedCards]);

    // 当 persistedCards 中有新卡片时，确保 localCards 中也有对应条目
    // 只处理 messages 不为空的卡片
    useEffect(() => {
        setLocalCards((prev) => {
            const newMap = new Map(prev);
            let changed = false;
            persistedCards
                .filter((card) => card.messages.length > 0)
                .forEach((card) => {
                    if (!newMap.has(card.id)) {
                        newMap.set(card.id, { isLoading: false });
                        changed = true;
                    }
                });
            // 清理已经不存在的卡片（包括 messages 为空的）
            const persistedIds = new Set(
                persistedCards
                    .filter((c) => c.messages.length > 0)
                    .map((c) => c.id),
            );
            for (const id of newMap.keys()) {
                if (!persistedIds.has(id) && id !== "default") {
                    newMap.delete(id);
                    changed = true;
                }
            }
            return changed ? newMap : prev;
        });
    }, [persistedCards]);

    // 合并持久化数据和本地状态，生成完整的卡片数据
    // 过滤掉 messages 为空的持久化卡片，但保留本地状态中的卡片（可能还未发送消息）
    const cards = useMemo<ChatCardData[]>(() => {
        // 从持久化数据中获取 messages 不为空的卡片
        const persistedCardsWithMessages = persistedCards.filter(
            (c) => c.messages.length > 0,
        );

        // 合并持久化卡片和本地状态中的卡片（可能不在持久化中）
        const cardMap = new Map<string, ChatCardData>();

        // 先添加持久化的卡片
        persistedCardsWithMessages.forEach((persisted) => {
            const local = localCards.get(persisted.id);
            cardMap.set(persisted.id, {
                ...persisted,
                isLoading: local?.isLoading ?? false,
                next: local?.next,
            });
        });

        // 再添加本地状态中存在但不在持久化中的卡片（messages 为空的新卡片）
        localCards.forEach((local, id) => {
            if (!cardMap.has(id) && id !== "default") {
                const persisted = persistedCards.find((c) => c.id === id);
                cardMap.set(id, {
                    id,
                    messages: persisted?.messages ?? [],
                    input: persisted?.input ?? "",
                    isLoading: local.isLoading,
                    next: local.next,
                });
            }
        });

        return Array.from(cardMap.values());
    }, [persistedCards, localCards]);

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

    // 同步到 store 的辅助函数（只保存可持久化的数据）
    // messages 为空的卡片不持久化
    const syncToStore = (
        cardId: string,
        updates: Partial<PersistedChatCard>,
    ) => {
        // 从 cards 或 persistedCards 中获取卡片信息
        const card = cards.find((c) => c.id === cardId);
        const persistedCard = persistedCards.find((c) => c.id === cardId);

        // 合并更新后的数据
        const baseCard = card || persistedCard;
        if (!baseCard && !updates.messages) {
            // 如果没有基础数据且没有 messages 更新，无法判断，直接返回
            return;
        }

        const updatedCard = baseCard
            ? { ...baseCard, ...updates }
            : ({ id: cardId, ...updates } as PersistedChatCard);

        // 如果 messages 为空，从持久化中删除
        if (updatedCard.messages.length === 0) {
            // 检查是否在持久化中
            if (persistedCards.some((c) => c.id === cardId)) {
                removePersistedCard(cardId);
            }
            return;
        }

        // 如果 messages 不为空，更新或添加到持久化
        if (persistedCards.some((c) => c.id === cardId)) {
            updatePersistedCard(cardId, updates);
        } else {
            // 如果不在持久化中，添加（但只添加 messages 不为空的情况）
            addPersistedCard(updatedCard as PersistedChatCard);
        }
    };

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
                    setLocalCards((prev) => {
                        const newMap = new Map(prev);
                        const existing = newMap.get(cardId) || {
                            isLoading: false,
                        };
                        newMap.set(cardId, { ...existing, next });
                        return newMap;
                    });
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
                // 设置本地状态（先设置，这样 syncToStore 可以找到卡片）
                setLocalCards((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(newId, { next, isLoading: true });
                    return newMap;
                });
                setActiveCardId(newId);
                // 发送消息
                const response = await next(message);
                // 更新持久化数据（messages 不为空，会被添加到持久化）
                syncToStore(newId, {
                    messages: [
                        { role: "user", content: message },
                        { role: "assistant", content: response },
                    ],
                    input: "",
                });
                // 更新本地状态
                setLocalCards((prev) => {
                    const newMap = new Map(prev);
                    const existing = newMap.get(newId);
                    if (existing) {
                        newMap.set(newId, { ...existing, isLoading: false });
                    }
                    return newMap;
                });
            } catch (error) {
                // 设置本地状态
                setLocalCards((prev) => {
                    const newMap = new Map(prev);
                    newMap.set(newId, { isLoading: false });
                    return newMap;
                });
                setActiveCardId(newId);
                // 更新持久化数据（messages 不为空，会被添加到持久化）
                syncToStore(newId, {
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
                });
            }
            return;
        }

        const card = cards.find((c) => c.id === cardId);
        if (!card || !card.next || card.isLoading) {
            return;
        }

        // 更新持久化数据：添加用户消息，清空输入
        syncToStore(cardId, {
            messages: [...card.messages, { role: "user", content: message }],
            input: "",
        });
        // 更新本地状态：设置加载中
        setLocalCards((prev) => {
            const newMap = new Map(prev);
            const existing = newMap.get(cardId);
            if (existing) {
                newMap.set(cardId, { ...existing, isLoading: true });
            }
            return newMap;
        });

        try {
            const response = await card.next(message);
            // 更新持久化数据：添加助手回复
            syncToStore(cardId, {
                messages: [
                    ...card.messages,
                    { role: "user", content: message },
                    { role: "assistant", content: response },
                ],
            });
            // 更新本地状态：取消加载中
            setLocalCards((prev) => {
                const newMap = new Map(prev);
                const existing = newMap.get(cardId);
                if (existing) {
                    newMap.set(cardId, { ...existing, isLoading: false });
                }
                return newMap;
            });
        } catch (error) {
            // 更新持久化数据：添加错误消息
            syncToStore(cardId, {
                messages: [
                    ...card.messages,
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
            });
            // 更新本地状态：取消加载中
            setLocalCards((prev) => {
                const newMap = new Map(prev);
                const existing = newMap.get(cardId);
                if (existing) {
                    newMap.set(cardId, { ...existing, isLoading: false });
                }
                return newMap;
            });
        }
    };

    const handleNewChat = async () => {
        const newId = String(Date.now());
        const next = await createChatBox(envPromptRef.current);
        // messages 为空时不持久化，只在本地状态中创建
        setLocalCards((prev) => {
            const newMap = new Map(prev);
            newMap.set(newId, { next, isLoading: false });
            return newMap;
        });
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
        syncToStore(cardId, { input: value });
    };

    // 如果没有卡片且 activeCardId 为 null，设置为 "default"
    const displayActiveCardId = activeCardId ?? "default";

    // 创建稳定的卡片 ID 列表作为依赖
    const cardIds = useMemo(
        () => displayCards.map((c) => c.id).join(","),
        [displayCards],
    );

    // 监听滚动，确定当前可见的卡片
    // biome-ignore lint/correctness/useExhaustiveDependencies: 需要在卡片列表变化时重新计算可见卡片
    useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const handleScroll = () => {
            const containerRect = container.getBoundingClientRect();
            const containerCenter =
                containerRect.left + containerRect.width / 2;

            let closestCardId: string | null = null;
            let closestDistance = Infinity;

            cardRefs.current.forEach((cardElement, cardId) => {
                const cardRect = cardElement.getBoundingClientRect();
                const cardCenter = cardRect.left + cardRect.width / 2;
                const distance = Math.abs(cardCenter - containerCenter);

                if (distance < closestDistance) {
                    closestDistance = distance;
                    closestCardId = cardId;
                }
            });
            console.log(closestCardId, "closestCardId");
            if (closestCardId) {
                setVisibleCardId(closestCardId);
            }
        };

        container.addEventListener("scroll", handleScroll, { passive: true });
        // 初始检查
        handleScroll();

        return () => {
            container.removeEventListener("scroll", handleScroll);
        };
    }, [cardIds]);

    const handleDeleteCard = (cardId: string) => {
        if (cardId === "default") return;
        removePersistedCard(cardId);
        setLocalCards((prev) => {
            const newMap = new Map(prev);
            newMap.delete(cardId);
            return newMap;
        });
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
                            <div
                                key={card.id}
                                ref={(el) => {
                                    if (el) {
                                        cardRefs.current.set(card.id, el);
                                    } else {
                                        cardRefs.current.delete(card.id);
                                    }
                                }}
                                className="w-full shrink-0 snap-center"
                            >
                                <ChatCard
                                    card={card}
                                    isActive={card.id === displayActiveCardId}
                                    onActivate={() => setActiveCardId(card.id)}
                                    onSendMessage={(message) =>
                                        handleSendMessage(card.id, message)
                                    }
                                    onInputChange={(value) =>
                                        handleInputChange(card.id, value)
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

                    <PaginationIndicator
                        count={displayCards.length}
                        current={
                            visibleCardId
                                ? displayCards.findIndex(
                                      (v) => v.id === visibleCardId,
                                  )
                                : -1
                        }
                    />
                </div>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
