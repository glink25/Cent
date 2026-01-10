import { Collapsible } from "radix-ui";
import { useCallback, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { SnapDiv, type SnapDivInstance } from "@/hooks/use-snap";
import { useIntl } from "@/locale";
import { useAssistantStore } from "@/store/assistant";
import { PaginationIndicator } from "../indicator";
import { type ChatBox, createChatBox, type Message } from "./chat";
import { ChatCard } from "./chat-card";
import { type EnvArg, getEnvPrompt } from "./env";

type CardData = {
    messages: Message[];
    id: string;
    loading: boolean;
    title?: string;
};

const getId = () => Date.now().toString(16);

const createEmptyChat = () => ({ messages: [], id: getId(), loading: false });

export function Assistant({ env }: { env?: EnvArg }) {
    const t = useIntl();

    const envPrompt = useMemo(() => getEnvPrompt(env), [env]);
    const envPromptRef = useRef(envPrompt);
    envPromptRef.current = envPrompt;

    // 从 store 读取持久化的数据

    const scrollContainerRef = useRef<SnapDivInstance>(null);

    const isCollapsed = useAssistantStore((state) => state.isCollapsed);

    const [cards, _setCards] = useState<CardData[]>(() => {
        const exist = useAssistantStore
            .getState()
            .cards.map((c) => ({ ...c, loading: false }));
        return exist.length === 0 ? [createEmptyChat()] : exist;
    });

    const initialIndex = cards.findIndex(
        (c) => c.id === useAssistantStore.getState().activeCardId,
    );
    const [activeIndex, setActiveIndex] = useState(initialIndex);

    const setCards: typeof _setCards = useCallback((v) => {
        _setCards((prev) => {
            const newV = (() => {
                if (typeof v === "function") {
                    return v(prev);
                }
                return v;
            })();
            useAssistantStore.setState((state) => ({
                ...state,
                cards: newV.filter((v) => v.messages.length > 0),
            }));
            return newV;
        });
    }, []);

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
                const newCards = [...prev];
                newCards[i] = setter({ ...newCards[i] });
                return newCards;
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
                    title: result.title ?? prev.title,
                    messages: [
                        ...prev.messages,
                        { role: "assistant", content: result.content },
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
                            content: `Error: ${error instanceof Error ? error.message : String(error)}`,
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

    const handleDeleteCard = (id: string) => {
        setCards((prev) => {
            const newV = prev.filter((v) => v.id !== id);
            if (newV.length === 0) {
                return [createEmptyChat()];
            }
            return newV;
        });
    };

    const canAddNew = cards[0]?.messages.length !== 0;
    const addNewCard = () => {
        if (!canAddNew) {
            return;
        }
        setCards((prev) => [createEmptyChat(), ...prev]);
        setTimeout(() => {
            const container = scrollContainerRef.current;
            if (!container) {
                return;
            }
            container.scrollTo(0);
        }, 100);
    };

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
            <div className="flex items-center justify-between p-2 border-b group-data-[state=closed]:border-none">
                <div className="flex items-center gap-2">
                    <i className="icon-[mdi--robot] text-lg"></i>
                    <span className="text-sm font-medium">
                        {t("ai-assistant")}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    {canAddNew && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={addNewCard}
                            className="h-7 text-xs group-data-[state=closed]:hidden"
                        >
                            <i className="icon-[mdi--chat-plus-outline] mr-1"></i>
                            {t("new-ai-chat")}
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
            <Collapsible.Content className="data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close overflow-hidden">
                <div className="w-full pb-2">
                    <SnapDiv
                        initialIndex={initialIndex}
                        ref={scrollContainerRef}
                        onActiveIndexChange={useCallback(
                            (index: number) => {
                                useAssistantStore.setState((state) => ({
                                    ...state,
                                    activeCardId: cards[index]?.id,
                                }));
                                setActiveIndex(index);
                            },
                            [cards],
                        )}
                        className="overflow-x-auto w-full h-[300px] flex-shrink-0 py-2 flex gap-2 scrollbar-hidden snap-mandatory snap-x"
                    >
                        {cards.map((card) => (
                            <div
                                key={card.id}
                                className="w-full shrink-0 snap-center"
                            >
                                <ChatCard
                                    title={card.title}
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
                    </SnapDiv>

                    <PaginationIndicator
                        count={cards.length}
                        current={activeIndex}
                    />
                </div>
            </Collapsible.Content>
        </Collapsible.Root>
    );
}
