import { PopoverArrow } from "@radix-ui/react-popover";
import { type ReactNode, useEffect, useState } from "react";
import { type GuidePersistKey, useGuideStore } from "@/store/guide";
import { useIsLogin } from "@/store/user";
import { cn } from "@/utils";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { TooltipClassName } from "../ui/tooltip";

export function HintTooltip({
    children,
    persistKey,
    content,
}: {
    children?: ReactNode;
    persistKey: GuidePersistKey;
    content?: ReactNode;
}) {
    const isLogin = useIsLogin();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        setTimeout(() => {
            const shows = useGuideStore.getState()[persistKey];
            if (!shows) {
                setOpen(true);
            }
        }, 1000);
    }, [persistKey]);
    if (!isLogin) {
        return children;
    }
    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                setOpen(v);
                if (!v) {
                    useGuideStore.setState((prev) => ({
                        ...prev,
                        [persistKey]: true,
                    }));
                }
            }}
        >
            <PopoverTrigger asChild>{children}</PopoverTrigger>
            <PopoverContent
                side="bottom"
                align="end"
                alignOffset={-4}
                className={cn(TooltipClassName, "border-none w-fit")}
            >
                <PopoverArrow></PopoverArrow>
                {content}
            </PopoverContent>
        </Popover>
    );
}
