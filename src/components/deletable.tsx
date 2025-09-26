import { cn } from "@/utils";
import type { ReactNode } from "react";

export default function Deletable({
	children,
	className,
	onDelete,
}: {
	children?: ReactNode;
	className?: string;
	onDelete?: () => void;
}) {
	return (
		<div className={cn("relative", className)}>
			{children}
			<button
				className="absolute top-0 right-0 w-4 h-4 flex justify-center items-center translate-x-[30%] -translate-y-[30%] rounded-full bg-destructive"
				type="button"
				onClick={onDelete}
			>
				<i className="icon-[mdi--close] text-white size-3"></i>
			</button>
		</div>
	);
}
