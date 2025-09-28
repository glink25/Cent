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
			<i
				className={cn(
					"flex items-center justify-center min-w-4 min-h-4",
					className,
				)}
				style={{
					backgroundImage: `url(${svgSrc})`,
					backgroundSize: "contain",
					backgroundPosition: "center",
					backgroundRepeat: "no-repeat",
				}}
			></i>
		);
	}

	// 否则当作 className 使用
	return <i className={cn(icon, className)} />;
}
