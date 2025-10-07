/** biome-ignore-all lint/suspicious/noArrayIndexKey: <explanation> */

interface PaginationIndicatorProps {
	count: number;
	current: number;
	className?: string;
}

export const PaginationIndicator: React.FC<PaginationIndicatorProps> = ({
	count,
	current,
	className = "",
}) => {
	return (
		<div className={`flex items-center justify-center gap-2 ${className}`}>
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className={`w-1 h-1 rounded-full transition-all duration-300 ${
						i === current
							? "bg-stone-800 scale-110"
							: "bg-gray-300 opacity-70 hover:opacity-100"
					}`}
				/>
			))}
		</div>
	);
};
