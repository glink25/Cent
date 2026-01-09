import { create, type StateCreator } from "zustand";
import {
    createJSONStorage,
    type PersistOptions,
    persist,
} from "zustand/middleware";

export interface Message {
    role: "user" | "assistant";
    content: string;
}

export interface PersistedChatCard {
    id: string;
    messages: Message[];
    input: string;
}

type AssistantStore = {
    // 聊天卡片列表（只保存可持久化的数据）
    cards: PersistedChatCard[];
    // 当前激活的卡片 ID
    activeCardId: string | null;
    // 是否折叠
    isCollapsed: boolean;
    // 设置卡片列表
    setCards: (cards: PersistedChatCard[]) => void;
    // 添加卡片
    addCard: (card: PersistedChatCard) => void;
    // 更新卡片
    updateCard: (id: string, updates: Partial<PersistedChatCard>) => void;
    // 删除卡片
    removeCard: (id: string) => void;
    // 设置激活的卡片 ID
    setActiveCardId: (id: string | null) => void;
    // 设置折叠状态
    setIsCollapsed: (isCollapsed: boolean) => void;
};

type Persist<S> = (
    config: StateCreator<S>,
    options: PersistOptions<S>,
) => StateCreator<S>;

export const useAssistantStore = create<AssistantStore>()(
    (persist as Persist<AssistantStore>)(
        (set) => ({
            cards: [],
            activeCardId: null,
            isCollapsed: false,
            setCards: (cards) => set({ cards }),
            addCard: (card) =>
                set((state) => ({ cards: [card, ...state.cards] })),
            updateCard: (id, updates) =>
                set((state) => ({
                    cards: state.cards.map((c) =>
                        c.id === id ? { ...c, ...updates } : c,
                    ),
                })),
            removeCard: (id) =>
                set((state) => {
                    const newCards = state.cards.filter((c) => c.id !== id);
                    // 如果删除的是当前激活的卡片，切换到第一个卡片或 null
                    let newActiveCardId = state.activeCardId;
                    if (state.activeCardId === id) {
                        newActiveCardId =
                            newCards.length > 0 ? newCards[0].id : null;
                    }
                    return {
                        cards: newCards,
                        activeCardId: newActiveCardId,
                    };
                }),
            setActiveCardId: (id) => set({ activeCardId: id }),
            setIsCollapsed: (isCollapsed) => set({ isCollapsed }),
        }),
        {
            name: "assistant-store",
            storage: createJSONStorage(() => localStorage),
            version: 0,
            partialize(state) {
                return state;
            },
        },
    ),
);
