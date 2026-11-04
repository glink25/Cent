import { Skeleton } from "../ui/skeleton";

export default function WidgetPreviewSkeleton({
    className,
}: {
    className?: string;
}) {
    return (
        <div aria-busy="true" className={`p-4 ${className ?? ""}`}>
            <div className="space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
            </div>
        </div>
    );
}
