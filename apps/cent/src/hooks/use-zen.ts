import dayjs from "dayjs";
import { useCallback, useEffect, useMemo, useState } from "react";
import { create } from "zustand";
import { useShallow } from "zustand/shallow";
import { loadStorageAPI } from "@/api/storage/dynamic";
import type { Full } from "@/database/stash";
import type { PersonalMeta } from "@/ledger/extra-type";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import {
    getZenDayId,
    getZenStyleName,
    isZenEntranceOpen,
    showZenDialog,
} from "@/zen";
import { isZenFallbackDevMode } from "@/zen/dev";
import type { ZenDayId, ZenPost } from "@/zen/types";

type ZenPostsState = {
    posts: Full<ZenPost>[];
    refresh: () => Promise<void>;
    upsert: (post: ZenPost) => Promise<void>;
};

const EMPTY_AI_CONFIGS: NonNullable<
    NonNullable<PersonalMeta["assistant"]>["configs"]
> = [];

const useZenPostsState = create<ZenPostsState>()((set, get) => {
    const refresh = async () => {
        const { StorageAPI } = await loadStorageAPI();
        const bookId = useBookStore.getState().currentBookId;
        if (!bookId) return;
        const posts = await StorageAPI.getAllZenItems(bookId);
        set({ posts: posts ?? [] });
    };
    const upsert = async (post: ZenPost) => {
        const { StorageAPI } = await loadStorageAPI();
        const bookId = useBookStore.getState().currentBookId;
        if (!bookId) return;
        await StorageAPI.batchZen(bookId, [{ type: "update", value: post }]);
        await get().refresh();
    };
    loadStorageAPI().then(({ StorageAPI }) => {
        StorageAPI.onZenChange?.(() => void get().refresh());
        void get().refresh();
    });
    return { posts: [], refresh, upsert };
});

export function getPersonalZenPosts(userId = useUserStore.getState().id) {
    return useZenPostsState
        .getState()
        .posts.filter((post) => post.userId === userId);
}

export function getZenPostById(
    id: ZenDayId,
    userId = useUserStore.getState().id,
) {
    return getPersonalZenPosts(userId).find(
        (post) => post.id === `zen-${id}-${userId}`,
    );
}

export function refreshZenPosts() {
    return useZenPostsState.getState().refresh();
}

export function upsertZenPost(post: ZenPost) {
    return useZenPostsState.getState().upsert(post);
}

export function useZen() {
    const userId = useUserStore((state) => state.id);
    const {
        zen,
        configs: storedConfigs,
        defaultConfigId,
    } = useLedgerStore(
        useShallow((state) => {
            const personal = state.infos?.meta.personal?.[userId];
            return {
                zen: personal?.zen,
                configs: personal?.assistant?.configs,
                defaultConfigId: personal?.assistant?.defaultConfigId,
            };
        }),
    );
    const configs = storedConfigs ?? EMPTY_AI_CONFIGS;
    const allPosts = useZenPostsState((state) => state.posts);
    const refreshPosts = useZenPostsState((state) => state.refresh);
    const upsertPost = useZenPostsState((state) => state.upsert);
    const posts = useMemo(
        () => allPosts.filter((post) => post.userId === userId),
        [allPosts, userId],
    );
    const hasAIConfig = Boolean(
        (configs.length > 0 && defaultConfigId) || isZenFallbackDevMode(),
    );
    const updateSettings = useCallback(
        (value: NonNullable<PersonalMeta["zen"]>) =>
            useLedgerStore.getState().updatePersonalMeta((prev) => ({
                ...prev,
                zen: { ...prev.zen, ...value },
            })),
        [],
    );
    const getPostByDayId = useCallback(
        (dayId: string) =>
            posts.find((post) => post.id === `zen-${dayId}-${userId}`),
        [posts, userId],
    );

    return {
        settings: zen,
        configs,
        defaultConfigId,
        hasAIConfig,
        posts,
        todayPost: getPostByDayId(getZenDayId()),
        getPostByDayId,
        refreshPosts,
        upsertPost,
        updateSettings,
    };
}

export function useZenOverview() {
    const { settings, getPostByDayId } = useZen();
    const [now, setNow] = useState(dayjs());

    useEffect(() => {
        const timer = window.setInterval(() => setNow(dayjs()), 30_000);
        return () => window.clearInterval(timer);
    }, []);

    const enabled = Boolean(settings?.enabled);
    const dayId = getZenDayId(now);
    const ready =
        enabled &&
        isZenEntranceOpen(settings?.scheduledTime, now) &&
        !getPostByDayId(dayId);
    const styleName = getZenStyleName(now);
    const open = useCallback(() => {
        showZenDialog().catch(() => {});
    }, []);

    return { dayId, enabled, ready, styleName, open };
}
