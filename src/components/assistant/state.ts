import type { SetStateAction } from "react";
import { create, type StateCreator } from "zustand";
import { type PersistOptions, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "zustand-indexeddb";
import type { AbortablePromise, History, TurnResult } from "@/assistant";

export type Chat = {
    id: string;
    history: History;
    pending?: boolean; // 不需要持久化
    abortController?: AbortablePromise<AsyncIterable<TurnResult>>; //不需要持久化
};

export type AssistantChatState = {
    chats: Chat[];
    setChats: (updater: SetStateAction<Chat[]>) => void;
};

type PersistedAssistantChatState = {
    chats: Pick<Chat, "id" | "history">[];
};

type Persist<S, U = S> = (
    config: StateCreator<S>,
    options: PersistOptions<S, U>,
) => StateCreator<S>;

export const useAssistantChatStore = create<AssistantChatState>()(
    (persist as Persist<AssistantChatState, PersistedAssistantChatState>)(
        (set) => ({
            chats: [],
            setChats: (updater) =>
                set((state) => ({
                    chats:
                        typeof updater === "function"
                            ? (updater as (prev: Chat[]) => Chat[])(state.chats)
                            : updater,
                })),
        }),
        {
            name: "assistant-v2-chat-store",
            version: 1,
            storage: createIndexedDBStorage("assistant-v2", "chat-store"),
            partialize: (state): PersistedAssistantChatState => ({
                chats: state.chats.map(({ id, history }) => ({ id, history })),
            }),
        },
    ),
);
