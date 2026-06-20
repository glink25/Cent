import type { ReactNode } from "react";
import { cn } from "@/utils";
import { Skeleton } from "./ui/skeleton";

export default function Loading({
    children,
    className,
}: {
    children?: ReactNode;
    className?: string;
}) {
    return (
        <div className={cn("flex items-center gap-2", className)}>
            <i className="icon-[mdi--loading] animate-spin"></i>
            {children}
        </div>
    );
}

export const LoadingSkeleton = () => (
    <div className="w-full p-4 flex flex-col gap-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="w-full h-[200px] rounded" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
    </div>
);
