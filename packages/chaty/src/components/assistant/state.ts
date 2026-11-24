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
import { checkpointStorage } from "./checkpoint-storage";

export type Chat = {
    id: string;
    scope: string | null;
    isBranch?: true;
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
        | "id"
        | "scope"
        | "isBranch"
        | "history"
        | "contextState"
        | "contextEvents"
    >[];
};

type Persist<S, U = S> = (
    config: StateCreator<S>,
    options: PersistOptions<S, U>,
) => StateCreator<S>;

const checkpoints = checkpointStorage(
    createIndexedDBStorage<PersistedAssistantChatState>(
        "assistant-v4",
        "chat-store",
    ),
);
export const flushChatCheckpoints = checkpoints.flush;

let previousSnapshot: PersistedAssistantChatState = { chats: [] };
function persistedSnapshot(
    state: AssistantChatState,
): PersistedAssistantChatState {
    const previous = new Map(
        previousSnapshot.chats.map((chat) => [chat.id, chat]),
    );
    const chats = state.chats.map(
        ({ id, scope, isBranch, history, contextState, contextEvents }) => {
            const old = previous.get(id);
            if (
                old &&
                old.scope === scope &&
                old.isBranch === isBranch &&
                old.history === history &&
                old.contextState === contextState &&
                old.contextEvents === contextEvents
            )
                return old;
            return {
                id,
                scope,
                isBranch,
                history,
                contextState,
                contextEvents,
            };
        },
    );
    if (
        chats.length === previousSnapshot.chats.length &&
        chats.every((chat, index) => chat === previousSnapshot.chats[index])
    )
        return previousSnapshot;
    previousSnapshot = { chats };
    return previousSnapshot;
}

if (typeof document !== "undefined") {
    const onVisibilityChange = () => {
        if (document.visibilityState === "hidden") void flushChatCheckpoints();
    };
    const onPageHide = () => void flushChatCheckpoints();
    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    import.meta.hot?.dispose(() => {
        document.removeEventListener("visibilitychange", onVisibilityChange);
        window.removeEventListener("pagehide", onPageHide);
        void flushChatCheckpoints();
    });
}

export const useAssistantChatStore = create<AssistantChatState>()(
    (persist as Persist<AssistantChatState, PersistedAssistantChatState>)(
        (set) => ({
            chats: [],
            setChats: (updater) => {
                let checkpoint = false;
                set((state) => {
                    const chats =
                        typeof updater === "function"
                            ? updater(state.chats)
                            : updater;
                    const previous = new Map(
                        state.chats.map((chat) => [chat.id, chat]),
                    );
                    checkpoint =
                        chats.length !== state.chats.length ||
                        chats.some((chat) => {
                            const old = previous.get(chat.id);
                            return (
                                !old ||
                                (!chat.pending &&
                                    (old.history !== chat.history ||
                                        old.contextState !==
                                            chat.contextState ||
                                        old.contextEvents !==
                                            chat.contextEvents))
                            );
                        });
                    return { chats };
                });
                if (checkpoint) void flushChatCheckpoints();
            },
        }),
        {
            name: "assistant-v4-chat-store",
            version: 1,
            storage: checkpoints.storage,
            partialize: persistedSnapshot,
        },
    ),
);
