import "./zen.css";
import dayjs from "dayjs";
import { useMemo, useState } from "react";
import { useIntl } from "../i18n";
import { cn } from "../utils";
import { getZenStyleName } from "./date";
import type { ZenPost } from "./types";

function PostDetail({
    post,
    onBack,
    onForget,
}: {
    post: ZenPost;
    onBack: () => void;
    onForget: (post: ZenPost) => Promise<void>;
}) {
    const t = useIntl();
    const [confirming, setConfirming] = useState(false);
    const [pending, setPending] = useState(false);
    const [error, setError] = useState<string>();

    const forget = async () => {
        setPending(true);
        setError(undefined);
        try {
            await onForget(post);
        } catch (cause) {
            setError(
                cause instanceof Error && cause.message
                    ? cause.message
                    : t("zen-post-forget-error"),
            );
        } finally {
            setPending(false);
        }
    };
    return (
        <div className="zen-card zen-card--solid flex min-h-0 flex-1 flex-col overflow-hidden rounded-[2rem] p-6 sm:p-8">
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    className="zen-close-btn grid size-10 place-items-center rounded-full"
                    onClick={onBack}
                >
                    <i className="icon-[mdi--arrow-left] size-5" />
                </button>
                <div>
                    <div className="text-xs zen-text-subtle">
                        {dayjs(post.time).format("YYYY-MM-DD")}
                    </div>
                    <h2 className="text-xl font-semibold zen-heading">
                        {post.title ??
                            post.theme?.title ??
                            t("zen-posts-title")}
                    </h2>
                </div>
            </div>
            <div className="mt-6 flex-1 space-y-5 overflow-y-auto">
                <blockquote className="zen-quote rounded-[1.6rem] p-5 text-base leading-8">
                    {post.quote}
                </blockquote>
                <p className="text-sm leading-8 zen-text-muted">
                    {post.summary}
                </p>
                {post.intention && (
                    <div className="zen-surface rounded-[1.35rem] p-4 text-sm leading-7">
                        {post.intention}
                    </div>
                )}
            </div>
            <div className="mt-5 border-t border-red-500/15 pt-4">
                {confirming ? (
                    <div className="space-y-3">
                        <p className="text-sm leading-6 text-red-700 dark:text-red-300">
                            {t("zen-post-forget-confirm")}
                        </p>
                        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                            <button
                                type="button"
                                className="zen-btn zen-btn--ghost min-h-11 rounded-full px-5 text-sm disabled:opacity-45"
                                disabled={pending}
                                onClick={() => setConfirming(false)}
                            >
                                {t("zen-post-forget-cancel")}
                            </button>
                            <button
                                type="button"
                                className="min-h-11 rounded-full bg-red-600 px-5 text-sm font-medium text-white transition hover:bg-red-700 disabled:pointer-events-none disabled:opacity-45"
                                disabled={pending}
                                onClick={() => void forget()}
                            >
                                {pending
                                    ? t("zen-post-forgetting")
                                    : t("zen-post-forget")}
                            </button>
                        </div>
                    </div>
                ) : (
                    <button
                        type="button"
                        className="min-h-10 rounded-full px-4 text-sm text-red-700 transition hover:bg-red-500/10 dark:text-red-300"
                        onClick={() => {
                            setError(undefined);
                            setConfirming(true);
                        }}
                    >
                        {t("zen-post-forget")}
                    </button>
                )}
                {error && (
                    <p className="mt-2 text-sm text-red-700 dark:text-red-300">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}

export function ZenPostsView({
    posts,
    onCancel,
    onForget,
}: {
    posts: ZenPost[];
    onCancel?: () => void;
    onForget: (post: ZenPost) => Promise<void>;
}) {
    const t = useIntl();
    const [selected, setSelected] = useState<ZenPost>();
    const styleName = useMemo(() => getZenStyleName(), []);
    const sortedPosts = useMemo(
        () => [...posts].sort((a, b) => b.time - a.time),
        [posts],
    );

    return (
        <div
            className={cn(
                "zen-root zen-text relative flex h-full flex-col overflow-hidden px-4 sm:px-6 pt-[max(var(--safe-area-inset-top),20px)] pb-[max(var(--safe-area-inset-bottom),20px)]",
                `zen-style-${styleName}`,
            )}
        >
            <div className="zen-overlay pointer-events-none absolute inset-0" />
            <div className="relative mx-auto flex h-full min-h-0 w-full max-w-3xl flex-col gap-4">
                <div className="zen-header-bar flex items-center justify-between rounded-full px-4 py-2">
                    <h1 className="text-sm font-medium zen-heading">
                        {t("zen-posts-title")}
                    </h1>
                    <button
                        type="button"
                        className="zen-close-btn grid size-10 place-items-center rounded-full"
                        onClick={onCancel}
                    >
                        <i className="icon-[mdi--close] size-5" />
                    </button>
                </div>
                {selected ? (
                    <PostDetail
                        post={selected}
                        onBack={() => setSelected(undefined)}
                        onForget={async (post) => {
                            await onForget(post);
                            setSelected(undefined);
                        }}
                    />
                ) : (
                    <div className="zen-card flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[2rem] p-5 sm:p-7">
                        {sortedPosts.length === 0 ? (
                            <div className="grid flex-1 place-items-center text-sm zen-text-muted">
                                {t("zen-posts-empty")}
                            </div>
                        ) : (
                            <div className="grid gap-3">
                                {sortedPosts.map((post) => (
                                    <button
                                        key={post.id}
                                        type="button"
                                        className="zen-option rounded-[1.35rem] p-4 text-left transition hover:-translate-y-0.5"
                                        onClick={() => setSelected(post)}
                                    >
                                        <span className="block text-xs zen-text-subtle">
                                            {dayjs(post.time).format(
                                                "YYYY-MM-DD",
                                            )}
                                        </span>
                                        <span className="mt-1 block font-medium zen-heading">
                                            {post.title ??
                                                post.theme?.title ??
                                                post.summary}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
