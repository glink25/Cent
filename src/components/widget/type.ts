import type { CompiledWidget } from "./core/compile";

export type Widget = {
    id: string;
    name: string;
    code: string;
    permissions: string[];
    settings?: Record<string, any>;
    createdAt: number;
    updatedAt: number;
};

export type WidgetStore = {
    widgets: Widget[];
};

export type DSLNode = {
    type: "Flex" | "Text" | "Image" | "Container";
    props: Record<string, any>;
    children: DSLNode[];
    style: DSLStyle;
};

export type DSLStyle = {
    fontSize?: number | string;
    color?: string;
    bold?: boolean;
    direction?: "row" | "column";
    justify?: string;
    align?: string;
    gap?: number;
    width?: number | string;
    height?: number | string;
    mode?: "cover" | "contain";
    background?: string;
    padding?: number | string;
    borderRadius?: number | string;
};

export type WidgetPermissions = {
    billing: boolean;
    filter: boolean;
    budget: boolean;
    collaborators: boolean;
    category: boolean;
    currency: boolean;
    tag: boolean;
};

export type WidgetWithMeta = Widget & CompiledWidget;
