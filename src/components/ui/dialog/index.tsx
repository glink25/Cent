"use client";

import {
    AnimatePresence,
    type HTMLMotionProps,
    motion,
    type Transition,
} from "motion/react";
import { Dialog as DialogPrimitive } from "radix-ui";
import type * as React from "react";
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
        initial: { x: "100vw", y: 0 },
        // 动画状态 (打开时)
        animate: { x: 0, y: 0 },
        // 退出状态 (关闭时)
        exit: { x: "100vw", y: 0 }, // 保持 x 轴运动
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

    return (
        <DialogProvider value={{ isOpen, setIsOpen }}>
            <DialogPrimitive.Root
                data-slot="dialog"
                {...props}
                onOpenChange={setIsOpen}
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
            <motion.div
                key="dialog-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={transition}
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
    };

function DialogContent({
    from = "top",
    onOpenAutoFocus,
    onCloseAutoFocus,
    onEscapeKeyDown,
    onPointerDownOutside,
    onInteractOutside,
    transition = transitionProps,
    ...props
}: DialogContentProps) {
    // const initialRotation =
    //     from === "bottom" || from === "left" ? "20deg" : "-20deg";
    // const isVertical = from === "top" || from === "bottom";
    // const rotateAxis = isVertical ? "rotateX" : "rotateY";

    const isDesktop = useIsDesktop();
    console.log(isDesktop, "isdesk");

    // 动态选择变体
    const currentVariant = isDesktop
        ? animationVariants.desktop
        : animationVariants.mobile;

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
                key="dialog-content"
                data-slot="dialog-content"
                initial={currentVariant.initial}
                animate={currentVariant.animate}
                exit={currentVariant.exit}
                transition={transition}
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
