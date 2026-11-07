import type { SetStateAction } from "react";
import { create, type StateCreator } from "zustand";
import { type PersistOptions, persist } from "zustand/middleware";
import { createIndexedDBStorage } from "zustand-indexeddb";
import type {
    AbortablePromise,
    ContextEvent,
    ContextMetrics,
    ContextState,
    History,
    TurnResult,
} from "../../assistant";

export type Chat = {
    id: string;
    scope: string | null;
    history: History;
    contextState?: ContextState;
    contextEvents?: ContextEvent[];
    pendingContextEvent?: ContextEvent;
    contextStatus?: TurnResult["contextStatus"];
    contextMetrics?: ContextMetrics;
    // 运行时字段（不持久化，见下方 partialize）：用于支持多会话并发发送与中断。
    pending?: boolean;
    awaitingResponse?: boolean;
    activeTool?: string;
    activity?: TurnResult["activity"];
    turnStartedAt?: number;
    abortController?: AbortablePromise<AsyncIterable<TurnResult>>;
};

export type AssistantChatState = {
    chats: Chat[];
    setChats: (updater: SetStateAction<Chat[]>) => void;
};

type PersistedAssistantChatState = {
    chats: Pick<
        Chat,
        "id" | "scope" | "history" | "contextState" | "contextEvents"
    >[];
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
            name: "assistant-v4-chat-store",
            version: 1,
            storage: createIndexedDBStorage("assistant-v4", "chat-store"),
            partialize: (state): PersistedAssistantChatState => ({
                chats: state.chats.map(
                    ({ id, scope, history, contextState, contextEvents }) => ({
                        id,
                        scope,
                        history,
                        contextState,
                        contextEvents,
                    }),
                ),
            }),
        },
    ),
);
