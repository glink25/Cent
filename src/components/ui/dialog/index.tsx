"use client";

import {
    AnimatePresence,
    animate,
    type HTMLMotionProps,
    motion,
    type PanInfo,
    type ResolvedValues,
    type Transition,
    useDragControls,
    useMotionValue,
} from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { useCallback, useRef, useState } from "react";
import { useIsDesktop } from "@/hooks/use-media-query";
import { getStrictContext } from "./get-strict-context";
import { useControlledState } from "./use-controlled-state";

// component/DialogAnimation.jsx

// 1. 定义动画变体
const animationVariants = {
    // --- 桌面动画 (从下到上) ---
    desktop: {
        // 隐藏状态 (未打开)
        initial: { y: "100vh", x: 0 },
        // 动画状态 (打开时)
        animate: { y: 0, x: 0 },
        // 退出状态 (关闭时)
        exit: { y: "100vh", x: 0 }, // 保持 y 轴运动
    },

    // --- 移动端动画 (从右到左) ---
    mobile: {
        // 隐藏状态 (未打开)
        initial: { x: window.innerWidth, y: 0 },
        // 动画状态 (打开时)
        animate: { x: 0, y: 0 },
        // 退出状态 (关闭时)
        exit: { x: window.innerWidth, y: 0 }, // 保持 x 轴运动
    },
    fade: {
        // 隐藏状态 (未打开)
        initial: { opacity: 0, scale: 0.9 },
        // 动画状态 (打开时)
        animate: { opacity: 1, scale: 1 },
        // 退出状态 (关闭时)
        exit: { opacity: 0, scale: 0.9 },
    },
};

// 2. 定义过渡属性 (Transition)
const transitionProps: Transition = {
    type: "tween", // "tween" 类型允许使用 cubic-bezier
    ease: [0.32, 0.72, 0, 1], // 这是 iOS "push" 动画的精确贝塞尔曲线
    duration: 0.4, // iOS 动画通常在 0.35s - 0.4s 之间
};
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
    const { progress } = useDialog();
    const opacity = 1 - (progress ?? 1);
    return (
        <DialogPrimitive.Overlay data-slot="dialog-overlay" asChild forceMount>
            <div
                key="dialog-overlay"
                style={{ opacity }}
                className="!transition-none opacity-0"
                // initial={{ opacity: 0 }}
                // animate={{ opacity: 1 }}
                // exit={{ opacity: 0 }}
                // transition={transition}
                {...props}
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
    const contentRef = useRef<HTMLDivElement>(null); // 用于获取 Dialog 内容的 DOM 元素

    // 动态选择变体
    const currentVariant = fade
        ? animationVariants.fade
        : isDesktop
          ? animationVariants.desktop
          : animationVariants.mobile;

    const { setIsOpen, setProgress } = useDialog();
    const onClose = useCallback(() => {
        setIsOpen?.(false);
    }, [setIsOpen]);

    // 1. MotionValue 用于追踪 X 轴拖拽位置
    const x = useMotionValue(0);

    // 2. 引入 useDragControls
    const dragControls = useDragControls();

    /**
     * @description 检查手势开始位置是否在 DialogContent 的左侧边缘
     * @param event 原始 PointerEvent
     * @returns boolean 是否在边缘
     */
    const isPointerNearLeftEdge = useCallback(
        (event: React.PointerEvent) => {
            if (!contentRef.current || isDesktop || fade) return false;

            const rect = contentRef.current.getBoundingClientRect();
            // 假设 DialogContent 占据了屏幕大部分宽度

            // 边缘检测：我们只关心手指按下的 X 坐标
            const clickX = event.clientX;

            // 设置一个边缘区域的阈值 (例如，DialogContent 左侧 50px 区域)
            const edgeThreshold = 50;

            // 判定条件：点击的 X 坐标是否在 DialogContent 元素的左侧边缘内
            // 注意：由于 DialogContent 通常是全屏或接近全屏，我们检测点击是否在靠近左侧的区域
            const isNearEdge = clickX < rect.left + edgeThreshold;

            return isNearEdge;
        },
        [isDesktop, fade],
    );

    /**
     * @description 手动控制拖动开始
     */
    const handlePointerDown = useCallback(
        (event: React.PointerEvent) => {
            // 仅在非桌面端使用此逻辑
            if (isDesktop || fade) return;

            // 阻止事件的默认行为，防止浏览器默认拖动等

            // **核心逻辑：检测位置并有条件地启动拖动**
            if (isPointerNearLeftEdge(event)) {
                // 如果在左侧边缘，我们希望只允许拖动。
                // 此时可以手动启动 Framer Motion 的拖动
                dragControls.start(event);
                // event.preventDefault();
            } else {
                // 如果不在边缘，则不做任何操作，阻止 Framer Motion 启动拖动。
                // 此时手势将不会被识别为拖动。
            }
        },
        [isDesktop, dragControls, fade, isPointerNearLeftEdge],
    );

    // 3. 定义拖拽结束时的处理逻辑（保持不变）
    const handleDragEnd = useCallback(
        (event: PointerEvent, info: PanInfo) => {
            const { offset, velocity } = info;
            // ... (拖拽结束逻辑与原先保持一致) ...

            const dismissThreshold = 200;
            const velocityThreshold = 500;

            const shouldDismiss =
                offset.x > dismissThreshold || velocity.x > velocityThreshold;

            if (shouldDismiss && offset.x > 0) {
                animate(x, window.innerWidth, {
                    type: "tween",
                    duration: 0.3,
                    ease: "easeOut",
                }).then(() => {
                    onClose();
                });
            } else {
                animate(x, 0);
            }
        },
        [onClose, x],
    );

    const onUpdate = useCallback(
        (e: ResolvedValues) => {
            const p = fade
                ? 1 - Number(e.opacity)
                : isDesktop
                  ? toPx(`${e.y}`) / window.innerHeight
                  : toPx(`${e.x}`) / window.innerWidth;
            setProgress(Number(p.toFixed(2)));
        },
        [isDesktop, fade, setProgress],
    );

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
                // 绑定 X MotionValue
                style={{ x }}
                // --- 改造部分开始 ---
                drag={isDesktop ? false : "x"}
                dragListener={isDesktop ? undefined : false} // 关键：禁用 Framer Motion 的自动拖动监听
                dragControls={dragControls} // 关键：绑定拖动控制器
                onPointerDown={handlePointerDown} // 关键：手动处理 pointerdown 事件来启动拖动
                // --- 改造部分结束 ---

                // 限制：阻止向左 (负方向) 拖拽
                dragConstraints={{ left: 0 }}
                // 弹性：拖拽超出边界时的回弹系数
                dragElastic={0}
                // 监听拖拽结束事件
                onDragEnd={handleDragEnd}
                // 非手势触发的初始/进入/退出动画
                initial={currentVariant.initial}
                animate={currentVariant.animate}
                exit={currentVariant.exit}
                transition={transition}
                onUpdate={onUpdate}
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
