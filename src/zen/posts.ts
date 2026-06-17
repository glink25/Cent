import { useLedgerStore } from "@/store/ledger";
import { useUserStore } from "@/store/user";
import type { ZenDayId, ZenPost } from "./types";

export function getPersonalZenPosts(userId = useUserStore.getState().id) {
    return (
        useLedgerStore.getState().infos?.meta.personal?.[userId]?.zenPosts ?? []
    );
}

export function getZenPostById(id: ZenDayId) {
    return getPersonalZenPosts().find((post) => post.id === id);
}

export async function upsertZenPost(post: ZenPost) {
    await useLedgerStore.getState().updatePersonalMeta((prev) => {
        const posts = prev.zenPosts ?? [];
        return {
            ...prev,
            zenPosts: [
                post,
                ...posts.filter((item) => item.id !== post.id),
            ].slice(0, 120),
        };
    });
}
