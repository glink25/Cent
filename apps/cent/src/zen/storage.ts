import type { Full } from "@/database/stash";
import { BillIndexedDBStorage } from "@/database/storage";
import type { ZenPost } from "./types";

const zenStorage = (bookId: string) =>
    new BillIndexedDBStorage(`book-${bookId}--zen`);

export async function readZenPost(
    bookId: string,
    userId: string,
    dayId: string,
) {
    const post = await zenStorage(bookId).getItem<Full<ZenPost>>(
        `zen-${dayId}-${userId}`,
    );
    return post && String(post.userId) === userId ? post : undefined;
}

export async function readRecentZenPosts(
    bookId: string,
    userId: string,
    limit: number,
    excludeId?: string,
) {
    const storage = zenStorage(bookId);
    const canonicalOwner = (id: string) =>
        /^zen-\d{4}-\d{2}-\d{2}-(.+)$/.exec(id)?.[1];
    const matches = (post: Full<ZenPost>) => String(post.userId) === userId;
    // Older posts could have the period start in the time index. The
    // canonical ID has the actual Zen day and sorts newest first here.
    const posts = await storage.readRecentItems<Full<ZenPost>>(
        limit,
        (id) => id !== excludeId && canonicalOwner(id) === userId,
        matches,
        "zen-",
    );
    if (posts.length || limit <= 0) return posts;
    return storage.readRecentItems<Full<ZenPost>>(
        limit,
        (id) => id !== excludeId && canonicalOwner(id) === undefined,
        matches,
    );
}
