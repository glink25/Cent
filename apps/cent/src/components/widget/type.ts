import type { CompiledWidget } from "./core/compile";

export type Widget = {
    id: string;
    name: string;
    code: string;
    permissions: string[];
    settings?: Record<string, any>;
    storage?: Record<string, unknown>;
    createdAt: number;
    updatedAt: number;
};

export type WidgetStore = {
    widgets: Widget[];
};

export type DSLNode = {
    type:
        | "Flex"
        | "Text"
        | "Image"
        | "Container"
        | "Button"
        | "FilePicker"
        | "Attachment"
        | "Input"
        | "ChoiceGroup"
        | "Choice"
        | "Select"
        | "Switch"
        | "DateTimePicker"
        | "Line";
    key?: string;
    events?: { onTap?: string; onChange?: string };
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
    wrap?: boolean;
    grow?: number;
    shrink?: number;
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    paddingX?: number;
    paddingY?: number;
    borderWidth?: number;
    borderColor?: string;
    fontWeight?: "normal" | "medium" | "semibold" | "bold";
    textAlign?: "start" | "center" | "end";
    mode?: "cover" | "contain";
    background?: string;
    padding?: number | string;
    borderRadius?: number | string;
};

export type WidgetPermissions = {
    edit: boolean;
    storage: boolean;
    billing: boolean;
    filter: boolean;
    budget: boolean;
    collaborators: boolean;
    category: boolean;
    currency: boolean;
    tag: boolean;
};

export type WidgetWithMeta = Widget & CompiledWidget;
