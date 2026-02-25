"use client";

import {
    AnimatePresence,
    type HTMLMotionProps,
    motion,
    type PanInfo,
    type Transition,
    usePresence,
} from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsDesktop } from "@/hooks/use-media-query";
import { cn } from "@/utils";
import { registerSlideGesture } from "./gesture";
import { getStrictContext } from "./get-strict-context";
import { useControlledState } from "./use-controlled-state";

// component/DialogAnimation.jsx

// 1. 定义动画变体
const animationVariants = {
    // --- 桌面动画 (从下到上) ---
    desktop: {
        // 隐藏状态 (未打开)
        initial: {
            transform: "translateY(100vh)",
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0)",
        },
        // 动画状态 (打开时)
        animate: {
            transform: "translateY(0px)",
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0.5)",
        },
        // 退出状态 (关闭时)
        exit: {
            transform: "translateY(100vh)",
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0)",
        }, // 保持 y 轴运动
    },

    // --- 移动端动画 (从右到左) ---
    mobile: {
        // 隐藏状态 (未打开)
        initial: {
            transform: `translateX(${window.innerWidth}px)`,
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0)",
        },
        // 动画状态 (打开时)
        animate: {
            transform: `translateX(0px)`,
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0.5)",
        },
        // 退出状态 (关闭时)
        exit: {
            transform: `translateX(${window.innerWidth}px)`,
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0)",
        }, // 保持 x 轴运动
    },
    fade: {
        // 隐藏状态 (未打开)
        initial: {
            opacity: "0",
            transform: `scale(0.9)`,
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0)",
        },
        // 动画状态 (打开时)
        animate: {
            opacity: "1",
            transform: `scale(1)`,
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0.5)",
        },
        // 退出状态 (关闭时)
        exit: {
            opacity: "0",
            transform: `scale(0.9)`,
            boxShadow: "0 0 0 150vmax rgba(0, 0, 0, 0)",
        },
    },
};

const TRANSITION_DURATION = 400;
const TRANSITION_EASING = "ease";

// 2. 定义过渡属性 (Transition)
const transitionProps: Transition = {
    type: "tween", // "tween" 类型允许使用 cubic-bezier
    ease: [0.32, 0.72, 0, 1], // 这是 iOS "push" 动画的精确贝塞尔曲线
    duration: 0.4, // iOS 动画通常在 0.35s - 0.4s 之间
};

/**
 * 将 Motion.js 风格的 transition 转换为 Web Animations API 的参数
 */
function transformMotionToNative(transition: Transition) {
    const {
        duration = 0.3,
        ease = "easeOut",
        delay = 0,
        times,
        repeat = 0,
        repeatType = "loop",
    } = transition;

    // 1. 处理缓动函数 (Easing)
    let easing = "ease";
    if (Array.isArray(ease)) {
        // 处理 cubic-bezier 数组 [x1, y1, x2, y2]
        easing = `cubic-bezier(${ease.join(", ")})`;
    } else if (typeof ease === "string") {
        // 映射一些 Motion 常见的命名（如需扩展可在此添加）
        easing = ease === "linear" ? "linear" : ease;
    }

    // 2. 构建原生配置项
    const options = {
        duration: duration * 1000, // 秒转毫秒
        delay: delay * 1000,
        easing: easing,
        // WAAPI 的 iterations: Infinity 对应 Framer 的 repeat: Infinity
        iterations: repeat === Infinity ? Infinity : repeat + 1,
        // 处理循环方向
        direction: repeatType === "reverse" ? "alternate" : "normal",
        fill: "forwards", // 默认保留动画结束状态
    } as KeyframeAnimationOptions;

    return options;
}

type DialogContextType = {
    isOpen: boolean;
    setIsOpen: DialogProps["onOpenChange"];
    progress: number | undefined;
    setProgress: (v: number | undefined) => void;
};

const [DialogProvider, useDialog] =
    getStrictContext<DialogContextType>("DialogContext");

type DialogProps = React.ComponentProps<typeof DialogPrimitive.Root>;

function Dialog(props: DialogProps) {
    const [isOpen, setIsOpen] = useControlledState({
        value: props?.open,
        defaultValue: props?.defaultOpen,
        onChange: props?.onOpenChange,
    });
    const [progress, setProgress] = useState<number>();

    const onOpenChange = useCallback(
        (v: boolean) => {
            setIsOpen(v);
            if (!v) {
                setProgress(0);
            }
        },
        [setIsOpen],
    );

    return (
        <DialogProvider
            value={{
                isOpen,
                setIsOpen,
                progress,
                setProgress,
            }}
        >
            <DialogPrimitive.Root
                data-slot="dialog"
                {...props}
                onOpenChange={onOpenChange}
            />
        </DialogProvider>
    );
}

type DialogTriggerProps = React.ComponentProps<typeof DialogPrimitive.Trigger>;

function DialogTrigger(props: DialogTriggerProps) {
    return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

type DialogPortalProps = Omit<
    React.ComponentProps<typeof DialogPrimitive.Portal>,
    "forceMount"
>;

function DialogPortal(props: DialogPortalProps) {
    const { isOpen } = useDialog();

    return (
        <AnimatePresence>
            {isOpen && (
                <DialogPrimitive.Portal
                    data-slot="dialog-portal"
                    forceMount
                    {...props}
                />
            )}
        </AnimatePresence>
    );
}

type DialogOverlayProps = Omit<
    React.ComponentProps<typeof DialogPrimitive.Overlay>,
    "forceMount" | "asChild"
> &
    HTMLMotionProps<"div">;

function DialogOverlay({
    transition = { duration: 0.2, ease: "easeInOut" },
    ...props
}: DialogOverlayProps) {
    return (
        <DialogPrimitive.Overlay data-slot="dialog-overlay" asChild forceMount>
            <div
                key="dialog-overlay"
                {...props}
                style={{ ...props.style }}
                className={cn("!transition-none opacity-0", props.className)}
                // initial={{ opacity: 0 }}
                // animate={{ opacity: 1 }}
                // exit={{ opacity: 0 }}
                // transition={transition}
            />
        </DialogPrimitive.Overlay>
    );
}

type DialogFlipDirection = "top" | "bottom" | "left" | "right";

type DialogContentProps = Omit<
    React.ComponentProps<typeof DialogPrimitive.Content>,
    "forceMount" | "asChild"
> &
    HTMLMotionProps<"div"> & {
        from?: DialogFlipDirection;
    } & {
        swipe?: boolean;
        fade?: boolean;
    };

const toPx = (v: string) => {
    const p = ["vw", "vh"].find((x) => v.includes(x));
    if (!p) {
        return Number(v);
    }
    const W = p === "vw" ? window.innerWidth : window.innerHeight;
    const [w, x] = v.split(p).map((c) => (!c ? 0 : Number(c)));
    return x + (w / 100) * W;
};

function DialogContent({
    onOpenAutoFocus,
    onCloseAutoFocus,
    onEscapeKeyDown,
    onPointerDownOutside,
    onInteractOutside,
    transition = transitionProps,
    fade,
    swipe,
    ...props
}: DialogContentProps) {
    const isDesktop = useIsDesktop();
    const contentRef = useRef<HTMLDivElement>(null);
    const [isPresent, safeToRemove] = usePresence(); // 关键：获取是否正在被销毁

    // 动态选择变体
    const currentVariant = fade
        ? animationVariants.fade
        : isDesktop
          ? animationVariants.desktop
          : animationVariants.mobile;
    const transitionNative = useMemo(
        () => transformMotionToNative(transition),
        [transition],
    );

    const { setIsOpen, setProgress } = useDialog();
    const onClose = useCallback(() => {
        setIsOpen?.(false);
    }, [setIsOpen]);

    const dragDismiss = useRef(false);

    // 3. 定义拖拽结束时的处理逻辑（保持不变）
    const handleDragEnd = useCallback(
        (event: PointerEvent, info: PanInfo) => {
            const { offset, velocity } = info;
            console.log("drag stopped");
            // ... (拖拽结束逻辑与原先保持一致) ...

            const dismissThreshold = 200;
            const velocityThreshold = 500;

            const shouldDismiss =
                offset.x > dismissThreshold || velocity.x > velocityThreshold;

            if (shouldDismiss && offset.x > 0) {
                contentRef.current
                    ?.animate(
                        [
                            {
                                transform: `translateX(100vw)`,
                            },
                        ],
                        {
                            easing: "cubic-bezier(0, 0, 0.58, 1)",
                            duration: 300,
                            fill: "forwards",
                        },
                    )
                    .finished.then(() => {
                        dragDismiss.current = true;
                        onClose();
                    });
            } else {
                contentRef.current
                    ?.animate(
                        [
                            {
                                transform: `translateX(0px)`,
                            },
                        ],
                        {
                            easing: "cubic-bezier(0, 0, 0.58, 1)",
                            duration: 300,
                            fill: "forwards",
                        },
                    )
                    .finished.then((ani) => {
                        ani.commitStyles();
                        ani.cancel();
                        contentRef.current?.style.removeProperty("transform");
                    });
            }
        },
        [onClose],
    );

    useEffect(() => {
        if (isDesktop || fade) return;
        const root = contentRef.current;
        if (!root) {
            return;
        }
        const stop = registerSlideGesture(root, {
            onStart: ({ direction }) => {
                const bounds = root.getBoundingClientRect();
                if (direction === "y") return;
                return {
                    fullWidth: bounds.width,
                    fullHeight: bounds.height,
                };
            },
            onProgress(offset, { fullWidth }) {
                const offsetX = Math.max(0, Math.min(fullWidth, offset.x));
                root.style.transform = `translate3d(${offsetX}px,0,0)`;
                const p = offsetX / fullWidth;
                root.style.boxShadow = `0 0 0 150vmax rgba(0, 0, 0, ${0.5 - 0.5 * p})`;
            },
            onEnd: (offset, { fullWidth }) => {
                const offsetX = Math.max(0, Math.min(fullWidth, offset.x));
                const swProgress = offsetX / fullWidth;
                const acc = offset.accX();
                const leftTime = Math.max(
                    200,
                    (1 - swProgress) * TRANSITION_DURATION,
                );
                if (swProgress >= 0.5 || acc > 0.5) {
                    const ani1 = root.animate(
                        [
                            {
                                transform: "translate3d(100%,0,0)",
                                boxShadow: "0 0 0 150vmax rgba(0,0,0,0)",
                            },
                        ],
                        {
                            duration: leftTime,
                            iterations: 1,
                            fill: "forwards",
                            easing: "ease-out",
                        },
                    );

                    ani1.finished.then(async () => {
                        ani1.commitStyles();
                        ani1.cancel();
                        dragDismiss.current = true;
                        onClose();
                    });
                } else {
                    // cancel back
                    const ani1 = root.animate(
                        [
                            {
                                transform: "translate3d(0,0,0)",
                                boxShadow: "0 0 0 150vmax rgba(0,0,0,0.5)",
                            },
                        ],
                        {
                            duration: leftTime,
                            iterations: 1,
                            fill: "forwards",
                            easing: TRANSITION_EASING,
                        },
                    );
                    ani1.finished.then(() => {
                        ani1.commitStyles();
                        ani1.cancel();
                    });
                }
            },
        });
        return stop;
    }, [isDesktop, fade, onClose]);

    const initialPlayed = useRef(false);
    const exitPlayed = useRef(false);

    useEffect(() => {
        if (isPresent) {
            if (initialPlayed.current) {
                return;
            }
            initialPlayed.current = true;
            // 执行“进入”动画
            Array.from(Object.entries(currentVariant.animate)).forEach(
                ([prop, value]) => {
                    contentRef.current!.style[prop as any] = value;
                },
            );
            contentRef.current
                ?.animate([currentVariant.initial, currentVariant.animate], {
                    ...transitionNative,
                    fill: "forwards",
                })
                .finished.then((ani) => {
                    ani.commitStyles();
                    ani.cancel();
                });
        } else {
            if (exitPlayed.current) {
                return;
            }
            if (dragDismiss.current) {
                safeToRemove?.();
                return;
            }
            exitPlayed.current = true;
            // 执行“退出”动画
            const exitAnimation = async () => {
                await contentRef.current?.animate(
                    [currentVariant.animate, currentVariant.exit],
                    transitionNative,
                ).finished;
                safeToRemove?.(); // 动画结束后，手动通知 React 真正销毁 DOM
            };
            exitAnimation();
        }
    }, [isPresent, currentVariant, transitionNative, safeToRemove]);

    return (
        <DialogPrimitive.Content
            asChild
            forceMount
            onOpenAutoFocus={onOpenAutoFocus}
            onCloseAutoFocus={onCloseAutoFocus}
            onEscapeKeyDown={onEscapeKeyDown}
            onPointerDownOutside={onPointerDownOutside}
            onInteractOutside={onInteractOutside}
        >
            <motion.div
                ref={contentRef} // 绑定 ref 以获取 DOM 边界
                key="dialog-content"
                data-slot="dialog-content"
                {...props}
            />
        </DialogPrimitive.Content>
    );
}

type DialogCloseProps = React.ComponentProps<typeof DialogPrimitive.Close>;

function DialogClose(props: DialogCloseProps) {
    return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

type DialogHeaderProps = React.ComponentProps<"div">;

function DialogHeader(props: DialogHeaderProps) {
    return <div data-slot="dialog-header" {...props} />;
}

type DialogFooterProps = React.ComponentProps<"div">;

function DialogFooter(props: DialogFooterProps) {
    return <div data-slot="dialog-footer" {...props} />;
}

type DialogTitleProps = React.ComponentProps<typeof DialogPrimitive.Title>;

function DialogTitle(props: DialogTitleProps) {
    return <DialogPrimitive.Title data-slot="dialog-title" {...props} />;
}

type DialogDescriptionProps = React.ComponentProps<
    typeof DialogPrimitive.Description
>;

function DialogDescription(props: DialogDescriptionProps) {
    return (
        <DialogPrimitive.Description
            data-slot="dialog-description"
            {...props}
        />
    );
}

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogClose,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    useDialog,
    type DialogProps,
    type DialogTriggerProps,
    type DialogPortalProps,
    type DialogCloseProps,
    type DialogOverlayProps,
    type DialogContentProps,
    type DialogHeaderProps,
    type DialogFooterProps,
    type DialogTitleProps,
    type DialogDescriptionProps,
    type DialogContextType,
    type DialogFlipDirection,
};
