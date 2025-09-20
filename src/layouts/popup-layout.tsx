import type { ReactNode } from "react";
import { useIntl } from "@/locale";
import { cn } from "@/utils";

export default function PopupLayout({
	title,
	children,
	onBack,
	className,
}: {
	title?: string | ReactNode;
	children?: ReactNode;
	onBack?: () => void;
	className?: string;
}) {
	const t = useIntl();
	return (
		<div
			className={cn(
				"flex-1 flex flex-col overflow-hidden pt-[env(safe-area-inset-top)]",
				className,
			)}
		>
			<div className="flex justify-center items-center relative px-4 pt-4 pb-2 flex-shrink-0">
				<button
					type="button"
					className="absolute left-0 flex buttoned rounded-full py-1 pl-1 pr-3 cursor-pointer"
					onClick={() => {
						onBack?.();
					}}
				>
					<div className="flex items-center justify-center">
						<i className="icon-[mdi--chevron-left] size-5"></i>
					</div>
					{t("back")}
				</button>
				<div className="min-h-4 w-full flex justify-center items-center">
					{title}
				</div>
			</div>
			{children}
		</div>
	);
}
