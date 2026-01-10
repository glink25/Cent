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
}

type AssistantStore = {
    // 聊天卡片列表（只保存可持久化的数据）
    cards: PersistedChatCard[];
    // 当前激活的卡片 ID
    activeCardId: string | null;
    // 是否折叠
    isCollapsed: boolean;
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
