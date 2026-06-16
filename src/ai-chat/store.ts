import type { SetStateAction } from "react";
import { create, type StateCreator } from "zustand";
import { type PersistOptions, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "zustand-indexeddb";
import type { ChatShellChat } from "./components/chat-shell";

export type AIChatState = {
    chats: ChatShellChat[];
    currentChatId?: string;
    setChats: (updater: SetStateAction<ChatShellChat[]>) => void;
    setCurrentChatId: (id: string | undefined) => void;
};

type PersistedAIChatState = {
    chats: Pick<ChatShellChat, "id" | "history">[];
    currentChatId?: string;
};

type Persist<S, U = S> = (
    config: StateCreator<S>,
    options: PersistOptions<S, U>,
) => StateCreator<S>;

export const useAIChatStore = create<AIChatState>()(
    (persist as Persist<AIChatState, PersistedAIChatState>)(
        (set) => ({
            chats: [],
            currentChatId: undefined,
            setChats: (updater) =>
                set((state) => ({
                    chats:
                        typeof updater === "function"
                            ? (
                                  updater as (
                                      prev: ChatShellChat[],
                                  ) => ChatShellChat[]
                              )(state.chats)
                            : updater,
                })),
            setCurrentChatId: (currentChatId) => set({ currentChatId }),
        }),
        {
            name: "ai-chat-store",
            version: 1,
            storage: createIndexedDBStorage("ai-chat", "chat-store"),
            partialize: (state): PersistedAIChatState => ({
                chats: state.chats.map(({ id, history }) => ({ id, history })),
                currentChatId: state.currentChatId,
            }),
        },
    ),
);
