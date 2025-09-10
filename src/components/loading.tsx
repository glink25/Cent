import type { ReactNode } from "react";

export default function Loading({ children }: { children?: ReactNode }) {
	return (
		<div className="flex items-center gap-2">
			<i className="icon-[mdi--loading] animate-spin"></i>
			{children}
		</div>
	);
}
