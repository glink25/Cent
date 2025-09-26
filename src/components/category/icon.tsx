import { cn } from "@/utils";

export default function CategoryIcon({
	icon,
	className,
}: {
	className?: string;
	icon: string;
}) {
	// 判断是否为 <svg> 开头
	const isSvgString = icon.trim().startsWith("<svg");

	if (isSvgString) {
		// 用 data-uri 转换成 <img> 的 src
		const svgSrc = "data:image/svg+xml;utf8," + encodeURIComponent(icon);
		return (
			<i className={cn("inline-flex items-center justify-center", className)}>
				<img src={svgSrc} alt="icon" className="w-1em h-1em" />
			</i>
		);
	}

	// 否则当作 className 使用
	return <i className={cn(icon, className)} />;
}
