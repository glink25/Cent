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
		<Skeleton className="w-full h-[200px] rounded" />
		<div className="space-y-2">
			<Skeleton className="h-4 w-[250px]" />
			<Skeleton className="h-4 w-[200px]" />
		</div>
	</div>
);
