export type GestureOption<S = any> = {
    stop?: boolean;
    triggerX?:
        | number
        | ((initial: Touch, start: Touch) => "x" | "y" | false | undefined);
    onStart?: (arg: {
        direction: "x" | "y";
        offset: { x: number; y: number };
    }) => S | undefined;
    onProgress?: (
        offset: {
            x: number;
            y: number;
            accX: () => number;
            accY: () => number;
            direction: "x" | "y";
        },
        s: S,
    ) => void;
    onEnd?: (
        offset: {
            x: number;
            y: number;
            accX: () => number;
            accY: () => number;
            direction: "x" | "y";
        },
        s: S,
    ) => void;
};

const createAccDetector = () => {
    let values: { value: number; time: number }[] = [];
    const update = (v: number) => {
        values.push({ value: v, time: Date.now() });
    };
    const calcAcc = () => {
        const vss = values.slice(values.length - 4);
        if (vss.length < 3) return 0;
        const [v1, v2, v3] = values.slice(values.length - 4);
        const va = (v2.value - v1.value) / (v2.time - v1.time);
        const vb = (v3.value - v2.value) / (v3.time - v2.time);
        const ac = vb - va / (v3.time - v1.time);
        return ac;
    };
    const clear = () => {
        values = [];
    };
    return {
        update,
        calcAcc,
        clear,
    };
};

const detectTargetScrollable = (
    scrollTarget: HTMLElement | undefined | null,
    target: HTMLElement | undefined | null,
) => {
    if (!target) return false;
    if (!scrollTarget) return false;
    if (!scrollTarget.contains(target)) {
        return false;
    }
    const canScroll = scrollTarget?.clientHeight < scrollTarget?.scrollHeight;
    if (canScroll) {
        return scrollTarget.scrollTop > 0 ? "scrolled" : true;
    }
    return false;
};

export const registerSlideGesture = <S = any>(
    dom: HTMLElement,
    option: GestureOption<S>,
) => {
    let touchStart: Touch | undefined;

    let startReturned: S | undefined;

    let lastestOffset:
        | {
              x: number;
              y: number;
              accX: () => number;
              accY: () => number;
              direction: "x" | "y";
          }
        | undefined;

    let realTouchStart: Touch | undefined;
    const accX = createAccDetector();
    const accY = createAccDetector();
    let direction: "x" | "y" | undefined;

    let scrollable: ReturnType<typeof detectTargetScrollable> = false;
    const onTouchStart = (evt: TouchEvent) => {
        const touch = evt.touches[0];
        const scrollTarget = dom.querySelector<HTMLElement>(
            "[data-main-scroll-target]",
        );
        scrollable = detectTargetScrollable(
            scrollTarget,
            evt.target as HTMLElement,
        );
        realTouchStart = touch;
        if (option.stop) {
            evt.stopPropagation();
        }
    };

    const onMove = (evt: TouchEvent) => {
        if (!realTouchStart) {
            return;
        }
        const touch = evt.touches[0];

        if (
            scrollable === "scrolled" ||
            (scrollable === true && touch.clientY - realTouchStart.clientY < 0)
        ) {
            realTouchStart = undefined;
            return;
        }

        // const hingeY = Math.abs(realTouchStart.clientY - touch.clientY);

        if (direction === undefined) {
            const hingeX = Math.abs(realTouchStart.clientX - touch.clientX);
            const checkX = () => {
                if (typeof option.triggerX === "function") {
                    return option.triggerX(realTouchStart!, touch) || undefined;
                }
                return realTouchStart!.clientX < (option.triggerX ?? 50) &&
                    hingeX > 2
                    ? "x"
                    : "y";
            };
            direction = checkX();
            if (direction === undefined) {
                realTouchStart = undefined;
                return;
            }
        }

        if (!touchStart || startReturned === undefined) {
            touchStart = touch;
            startReturned = option.onStart?.({
                direction,
                offset: {
                    x: realTouchStart.clientX - touch.clientX,
                    y: realTouchStart.clientY - touch.clientY,
                },
            });
            evt.stopPropagation();
            return;
        }
        if (!touchStart || startReturned === undefined) {
            return;
        }
        const offsetX = touch.clientX - touchStart.clientX;
        accX.update(offsetX);
        const offsetY = touch.clientY - touchStart.clientY;
        accY.update(offsetY);
        const offset = {
            x: offsetX,
            y: offsetY,
            accX: accX.calcAcc,
            accY: accY.calcAcc,
            direction,
        };
        lastestOffset = offset;
        option.onProgress?.(offset, startReturned);
    };
    const onEnd = () => {
        if (!touchStart || !lastestOffset || startReturned === undefined) {
            touchStart = undefined;
            realTouchStart = undefined;
            lastestOffset = undefined;
            realTouchStart = undefined;
            direction = undefined;
            accX.clear();
            scrollable = false;
            return;
        }
        option.onEnd?.(lastestOffset, startReturned);
        touchStart = undefined;
        realTouchStart = undefined;
        lastestOffset = undefined;
        accX.clear();
        direction = undefined;
        scrollable = false;
    };

    dom.addEventListener("touchstart", onTouchStart, {
        passive: true,
        capture: option.stop,
    });
    dom.addEventListener("touchmove", onMove, { passive: true });
    dom.addEventListener("touchend", onEnd, { passive: true });

    return () => {
        dom.removeEventListener("touchstart", onTouchStart);
        dom.removeEventListener("touchmove", onMove);
        dom.removeEventListener("touchend", onEnd);
    };
};
