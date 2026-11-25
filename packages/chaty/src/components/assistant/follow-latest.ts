import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { Chat } from "./state";

export function useFollowLatest(chatId?: string, chat?: Chat) {
    const containerRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const following = useRef(true);
    const lastTop = useRef(0);
    const lastBottom = useRef(0);
    const restoreOverflow = useRef<(() => void) | undefined>(undefined);
    const [showLatest, setShowLatest] = useState(false);

    const scrollToLatest = useCallback(() => {
        const container = containerRef.current;
        if (!container) return;
        container.scrollTop = container.scrollHeight;
        lastTop.current = container.scrollTop;
        lastBottom.current = container.scrollHeight - container.clientHeight;
    }, []);

    const resumeFollowing = useCallback(() => {
        following.current = true;
        setShowLatest(false);
        const container = containerRef.current;
        const content = contentRef.current;
        if (!container || !content) return;

        restoreOverflow.current?.();
        const overflow = container.style.overflow;
        const transform = content.style.transform;
        const bottom = container.scrollHeight - container.clientHeight;
        // Remove the scroll container for a paint to cancel its fling.
        // Keep the latest message visible while the container is clipped.
        container.style.overflow = "clip";
        content.style.transform = `translateY(${-bottom}px)`;
        const restore = () => {
            cancelAnimationFrame(frame);
            clearTimeout(timeout);
            content.style.transform = transform;
            container.style.overflow = overflow;
            restoreOverflow.current = undefined;
        };
        const finish = () => {
            restore();
            scrollToLatest();
        };
        let frame = requestAnimationFrame(() => {
            frame = requestAnimationFrame(finish);
        });
        // An offscreen WebView may suspend animation frames.
        const timeout = window.setTimeout(finish, 100);
        restoreOverflow.current = restore;
    }, [scrollToLatest]);

    const turnStartedAt = chat?.turnStartedAt;
    useLayoutEffect(() => {
        following.current = true;
        setShowLatest(false);
        scrollToLatest();
        const container = containerRef.current;
        const content = contentRef.current;
        if (!chatId || !container || !content) return;

        const observer = new ResizeObserver(() => {
            if (following.current && !restoreOverflow.current) scrollToLatest();
        });
        observer.observe(container);
        observer.observe(content);
        return () => {
            observer.disconnect();
            restoreOverflow.current?.();
        };
    }, [chatId, scrollToLatest]);

    useLayoutEffect(() => {
        if (turnStartedAt === undefined) return;
        if (following.current) scrollToLatest();
        else resumeFollowing();
    }, [turnStartedAt, resumeFollowing, scrollToLatest]);

    useLayoutEffect(() => {
        if (chat && following.current && !restoreOverflow.current)
            scrollToLatest();
    }, [chat, scrollToLatest]);

    const onScroll = useCallback(() => {
        const container = containerRef.current;
        if (!container || restoreOverflow.current) return;
        const bottom = container.scrollHeight - container.clientHeight;
        const top = Math.max(0, Math.min(bottom, container.scrollTop));
        const previousTop = lastTop.current;
        const resized = bottom !== lastBottom.current;
        lastTop.current = top;
        lastBottom.current = bottom;

        // A resize can clamp the scroll position. It is not an upward gesture.
        if (resized) {
            if (following.current) scrollToLatest();
            return;
        }
        const atBottom = bottom - top <= 2;
        if (following.current && !atBottom && top < previousTop) {
            following.current = false;
            setShowLatest(true);
        } else if (!following.current && atBottom && top > previousTop) {
            following.current = true;
            setShowLatest(false);
        }
    }, [scrollToLatest]);

    return { containerRef, contentRef, onScroll, resumeFollowing, showLatest };
}
