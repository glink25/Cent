import { create } from "zustand";
import { loadStorageAPI } from "@/api/storage/dynamic";
import type { Full } from "@/database/stash";
import { useBookStore } from "@/store/book";
import { useUserStore } from "@/store/user";
import type { ZenDayId, ZenPost } from "./types";

type ZenPostsStore = {
    posts: Full<ZenPost>[];
    refresh: () => Promise<void>;
};

/**
 * zen 帖子的本地响应式缓存。
 * 数据真正存放在 tidal 的 "zen" entry（远端 zen-*.json），这里仅做同步读取的镜像，
 * 以便 `getPersonalZenPosts` 等保持同步调用语义。
 */
export const useZenPostsStore = create<ZenPostsStore>()((set) => {
    const refresh = async () => {
        const { StorageAPI } = await loadStorageAPI();
        const bookId = useBookStore.getState().currentBookId;
        if (!bookId) {
            return;
        }
        const posts = await StorageAPI.getAllZenItems(bookId);
        set({ posts: posts ?? [] });
    };

    // 订阅 zen 数据变化（init / batch / 同步拉取后都会触发）
    loadStorageAPI().then(({ StorageAPI }) => {
        StorageAPI.onZenChange?.(() => {
            refresh();
        });
    });
    refresh();

    return { posts: [], refresh };
});

export function getPersonalZenPosts(userId = useUserStore.getState().id) {
    const uid = userId;
    return useZenPostsStore.getState().posts.filter((p) => p.userId === uid);
}

export function getZenPostById(id: ZenDayId) {
    const uid = useUserStore.getState().id;
    return getPersonalZenPosts().find((post) => post.id === `zen-${id}-${uid}`);
}

export async function upsertZenPost(post: ZenPost) {
    const { StorageAPI } = await loadStorageAPI();
    const bookId = useBookStore.getState().currentBookId;
    if (!bookId) {
        return;
    }
    await StorageAPI.batchZen(bookId, [{ type: "update", value: post }]);
    await useZenPostsStore.getState().refresh();
}
