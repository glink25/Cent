import { PopoverArrow } from "@radix-ui/react-popover";
import { type ReactNode, useEffect, useState } from "react";
import { useBookStore } from "@/store/book";
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
    const shows = useGuideStore((state) => state[persistKey]);
    const [open, setOpen] = useState(false);
    const curBook = useBookStore((state) => state.currentBookId);

    useEffect(() => {
        setTimeout(() => {
            const shows = useGuideStore.getState()[persistKey];
            if (!shows) {
                setOpen(true);
            }
        }, 1000);
    }, [persistKey]);
    if (!isLogin || !curBook || shows) {
        return children;
    }
    return (
        <Popover
            open={open}
            onOpenChange={(v) => {
                if (!v) {
                    useGuideStore.setState((prev) => ({
                        ...prev,
                        [persistKey]: true,
                    }));
                    setOpen(v);
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
