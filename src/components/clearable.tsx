import React, { type FC, type ReactNode } from "react";
import { cn } from "@/utils";

interface ClearableProps {
	visible?: boolean;
	onClear?: () => void;
	children: ReactNode;
	className?: string;
}

const Clearable: FC<ClearableProps> = ({
	visible,
	onClear,
	children,
	className,
}) => {
	return (
		<div className={cn("flex items-center", className)}>
			{children}
			{visible && (
				<button
					type="button"
					className={cn(
						"flex items-center rounded-full justify-center hover:bg-accent hover:text-accent-foreground",
					)}
					onClick={onClear}
				>
					<i className="icon-[mdi--close] opacity-80 size-4"></i>
				</button>
			)}
		</div>
	);
};

export default Clearable;
