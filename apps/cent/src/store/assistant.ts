import { create, type StateCreator } from "zustand";
import {
    createJSONStorage,
    type PersistOptions,
    persist,
} from "zustand/middleware";
import { useBookStore } from "./book";

export interface Message {
    role: "user" | "assistant";
    content: string;
}

export interface PersistedChatCard {
    id: string;
    messages: Message[];
}

type AssistantStore = {
    records: Record<
        string,
        {
            // 聊天卡片列表（只保存可持久化的数据）
            cards: PersistedChatCard[];
            // 当前激活的卡片 ID
            activeCardId: string | null;
            // 是否折叠
            isCollapsed: boolean;
        }
    >;
    isCollapsed: boolean;
};

type Persist<S> = (
    config: StateCreator<S>,
    options: PersistOptions<S>,
) => StateCreator<S>;

export const useAssistantStore = create<AssistantStore>()(
    (persist as Persist<AssistantStore>)(
        (set) => ({
            records: {},
            isCollapsed: false,
        }),
        {
            name: "assistant-store",
            storage: createJSONStorage(() => localStorage),
            partialize(state) {
                return state;
            },
            version: 1,
            migrate(persistedState, version) {
                if (version === 0) {
                    // 如果旧版本是 0，我们将其转换为版本 1 的格式
                    const oldState = persistedState as any;
                    const localBook = useBookStore.getState().currentBookId;
                    if (!localBook) {
                        return {};
                    }
                    return {
                        [localBook]: { records: oldState },
                        isCollapsed: oldState.isCollapsed,
                    };
                }

                return persistedState as any;
            },
        },
    ),
);
