import type { CSSProperties } from "react";
import type { DSLNode } from "./type";

function styleToCSS(style: DSLNode["style"]): CSSProperties {
    const css: CSSProperties = {};

    if (style.fontSize) {
        css.fontSize =
            typeof style.fontSize === "number"
                ? `${style.fontSize}px`
                : style.fontSize;
    }
    if (style.color) {
        css.color = style.color;
    }
    if (style.bold) {
        css.fontWeight = "bold";
    }
    if (style.direction) {
        css.flexDirection = style.direction;
    }
    if (style.justify) {
        css.justifyContent = style.justify;
    }
    if (style.align) {
        css.alignItems = style.align;
    }
    if (style.gap !== undefined) {
        css.gap = style.gap;
    }
    if (style.width) {
        css.width =
            typeof style.width === "number" ? `${style.width}px` : style.width;
    }
    if (style.height) {
        css.height =
            typeof style.height === "number"
                ? `${style.height}px`
                : style.height;
    }
    if (style.mode) {
        css.objectFit = style.mode;
    }
    if (style.background) {
        css.background = style.background;
    }
    if (style.padding !== undefined) {
        css.padding =
            typeof style.padding === "number"
                ? `${style.padding}px`
                : style.padding;
    }
    if (style.borderRadius !== undefined) {
        css.borderRadius =
            typeof style.borderRadius === "number"
                ? `${style.borderRadius}px`
                : style.borderRadius;
    }

    return css;
}

function WidgetNode({ node, path = "" }: { node: DSLNode; path?: string }) {
    const style = styleToCSS(node.style);

    switch (node.type) {
        case "Text":
            return <span style={style}>{node.props.content}</span>;

        case "Image":
            return <img src={node.props.src} alt="" style={style} />;

        case "Flex":
            return (
                <div style={{ display: "flex", ...style }}>
                    {node.children.map((child, index) => (
                        <WidgetNode
                            key={`${path}-${child.type}-${index}`}
                            node={child}
                            path={`${path}-${child.type}-${index}`}
                        />
                    ))}
                </div>
            );

        case "Container":
            return (
                <div style={style}>
                    {node.children.map((child, index) => (
                        <WidgetNode
                            key={`${path}-${child.type}-${index}`}
                            node={child}
                            path={`${path}-${child.type}-${index}`}
                        />
                    ))}
                </div>
            );

        default:
            return null;
    }
}

type WidgetRendererProps = {
    dsl: DSLNode | null | undefined;
    className?: string;
};

export default function WidgetRenderer({
    dsl,
    className,
}: WidgetRendererProps) {
    if (!dsl) {
        return (
            <div
                className={`flex items-center justify-center text-sm opacity-50 ${className ?? ""}`}
            >
                No preview available
            </div>
        );
    }

    return (
        <div className={className}>
            <WidgetNode node={dsl} />
        </div>
    );
}
