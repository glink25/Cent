/** One pending snapshot per run, with a non-sliding foreground deadline. */
export function streamUpdates<T>(commit: (value: T) => void) {
    let pending: T | undefined;
    let frame: number | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;

    const cancel = () => {
        if (frame !== undefined) cancelAnimationFrame(frame);
        clearTimeout(deadline);
        frame = undefined;
        deadline = undefined;
    };
    const flush = () => {
        cancel();
        const value = pending;
        pending = undefined;
        if (value !== undefined) commit(value);
    };
    return {
        push(value: T, immediate = false) {
            if (immediate) {
                flush();
                commit(value);
                return;
            }
            pending = value;
            if (deadline !== undefined) return;
            frame = requestAnimationFrame(flush);
            deadline = setTimeout(flush, 50);
        },
        flush,
        cancel() {
            pending = undefined;
            cancel();
        },
    };
}
