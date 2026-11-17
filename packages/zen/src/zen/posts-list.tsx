import "./zen.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { useIntl } from "../i18n";
import { getZenPostDayId, type ZenStyleName } from "./date";
import { ZenFrame } from "./frame";
import { savedReflections } from "./post-view";
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
    const cancelRef = useRef<HTMLButtonElement>(null);
    const forgetRef = useRef<HTMLButtonElement>(null);

    useEffect(() => {
        if (confirming) cancelRef.current?.focus();
    }, [confirming]);

    const cancelForget = () => {
        setConfirming(false);
        setError(undefined);
        requestAnimationFrame(() => forgetRef.current?.focus());
    };

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
        <div
            className="zen-card zen-card--solid zen-scroll relative min-h-0 flex-1 overflow-y-auto rounded-[2rem] p-5 sm:p-7"
            data-main-scroll-target
        >
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    aria-label={t("zen-posts-back")}
                    className="zen-close-btn grid size-11 shrink-0 place-items-center rounded-full"
                    onClick={onBack}
                >
                    <i
                        aria-hidden="true"
                        className="icon-[mdi--arrow-left] size-5"
                    />
                </button>
                <div>
                    <div className="text-xs zen-text-subtle">
                        {getZenPostDayId(post)}
                    </div>
                    <h2 className="text-xl font-semibold zen-heading">
                        {post.title ??
                            post.theme?.title ??
                            t("zen-posts-title")}
                    </h2>
                </div>
            </div>
            <div className="mt-5 space-y-5">
                <blockquote className="zen-quote rounded-[1.6rem] p-5 text-base leading-8">
                    {post.quote}
                </blockquote>
                <p className="text-sm leading-8 zen-text-muted">
                    {post.summary}
                </p>
                {savedReflections(post).map((reflection) => (
                    <details
                        key={reflection.id}
                        className="zen-surface rounded-xl p-4 text-sm"
                    >
                        <summary className="cursor-pointer">
                            {reflection.title ??
                                reflection.text[0] ??
                                reflection.id}
                        </summary>
                        <div className="mt-3 space-y-2 leading-7">
                            {reflection.text.map((text, i) => (
                                <p key={i}>{text}</p>
                            ))}
                            {reflection.answers.map((answer, i) => (
                                <p key={i} className="zen-text-muted">
                                    {answer}
                                </p>
                            ))}
                            {reflection.snapshots.length > 0 && (
                                <pre className="whitespace-pre-wrap text-xs">
                                    {JSON.stringify(
                                        reflection.snapshots,
                                        null,
                                        2,
                                    )}
                                </pre>
                            )}
                        </div>
                    </details>
                ))}
                {post.intention && (
                    <div className="zen-surface rounded-[1.35rem] p-4 text-sm leading-7">
                        {post.intention}
                    </div>
                )}
            </div>
            <div className="zen-forget-section mt-5 border-t pt-4">
                {confirming ? (
                    <div className="space-y-3">
                        <p className="zen-danger-text text-sm leading-6">
                            {t("zen-post-forget-confirm")}
                        </p>
                        <div className="flex flex-wrap justify-end gap-2">
                            <button
                                type="button"
                                className="zen-btn zen-btn--ghost min-h-11 rounded-full px-5 text-sm disabled:opacity-45"
                                ref={cancelRef}
                                disabled={pending}
                                onClick={cancelForget}
                            >
                                {t("zen-post-forget-cancel")}
                            </button>
                            <button
                                type="button"
                                className="zen-btn zen-btn--danger min-h-11 rounded-full px-5 text-sm font-medium transition disabled:opacity-45"
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
                        ref={forgetRef}
                        className="zen-btn zen-btn--ghost zen-danger-text min-h-11 rounded-full px-4 text-sm transition"
                        onClick={() => {
                            setError(undefined);
                            setConfirming(true);
                        }}
                    >
                        {t("zen-post-forget")}
                    </button>
                )}
                {error && (
                    <p
                        role="alert"
                        className="zen-danger-text mt-2 whitespace-pre-wrap text-sm"
                    >
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}

export function ZenPostsView({
    posts,
    styleName,
    onCancel,
    onForget,
}: {
    posts: ZenPost[];
    styleName: ZenStyleName;
    onCancel?: () => void;
    onForget: (post: ZenPost) => Promise<void>;
}) {
    const t = useIntl();
    const [selected, setSelected] = useState<ZenPost>();
    const sortedPosts = useMemo(
        () =>
            [...posts].sort(
                (a, b) =>
                    getZenPostDayId(b).localeCompare(getZenPostDayId(a)) ||
                    b.completedAt - a.completedAt,
            ),
        [posts],
    );

    return (
        <ZenFrame
            styleName={styleName}
            onClose={onCancel}
            closeLabel={t("zen-posts-back-today")}
            header={
                <h1 className="px-1 text-sm font-medium zen-heading">
                    {t("zen-posts-title")}
                </h1>
            }
        >
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
                <div
                    data-main-scroll-target
                    className="zen-card zen-scroll relative flex min-h-0 flex-1 flex-col overflow-y-auto rounded-[2rem] p-5 sm:p-7"
                >
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
                                    className="zen-option min-w-0 rounded-[1.35rem] p-4 text-left transition hover:-translate-y-0.5"
                                    onClick={() => setSelected(post)}
                                >
                                    <span className="block text-xs zen-text-subtle">
                                        {getZenPostDayId(post)}
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
        </ZenFrame>
    );
}
