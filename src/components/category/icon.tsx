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
        return (
            <i
                className={cn(
                    "flex items-center justify-center min-w-4 min-h-4 [&>svg]:w-[1em] [&>svg]:h-[1em]",
                    className,
                )}
                // biome-ignore lint/security/noDangerouslySetInnerHtml: SVG string needs inline rendering to support currentColor
                dangerouslySetInnerHTML={{ __html: icon }}
            />
        );
    }

    // 否则当作 className 使用
    return <i className={cn(icon, className)} />;
}
