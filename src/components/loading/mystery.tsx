import { cn } from "@/utils";
import "./mystery.css";
import type { ReactNode } from "react";
export const MysteryLoading = ({
    className,
    children,
}: {
    className?: string;
    children?: ReactNode;
}) => {
    return (
        <div
            className={cn(
                "loading-container relative flex items-center justify-center w-full h-full overflow-hidden",
                className,
            )}
        >
            <div className="nebula-effect z-[-1] absolute w-full h-full" />
            {children}
        </div>
    );
};
