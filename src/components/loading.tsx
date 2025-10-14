import type { ReactNode } from "react";
import { Skeleton } from "./ui/skeleton";

export default function Loading({ children }: { children?: ReactNode }) {
    return (
        <div className="flex items-center gap-2">
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
