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
        const useMaskMode = icon.includes(`data-render="mask"`);
        const svgSrc = "data:image/svg+xml;utf8," + encodeURIComponent(icon);

        if (useMaskMode) {
            // 用于 mask 的 SVG 需为不透明形状，将 currentColor 改为 black 以保证遮罩正确
            const maskSvg = icon.replace(
                /\bfill=["']currentColor["']/gi,
                'fill="black"',
            );
            const maskSvgSrc =
                "data:image/svg+xml;utf8," + encodeURIComponent(maskSvg);
            return (
                <i
                    className={cn(
                        "inline-block w-4 h-4 min-w-4 min-h-4",
                        className,
                    )}
                    style={{
                        backgroundColor: "currentColor",
                        WebkitMaskImage: `url(${maskSvgSrc})`,
                        maskImage: `url(${maskSvgSrc})`,
                        WebkitMaskRepeat: "no-repeat",
                        maskRepeat: "no-repeat",
                        WebkitMaskSize: "100% 100%",
                        maskSize: "100% 100%",
                        WebkitMaskPosition: "center",
                        maskPosition: "center",
                    }}
                />
            );
        }

        // 原有 background-image 模式
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
            />
        );
    }

    // 否则当作 className 使用
    return <i className={cn(icon, className)} />;
}
