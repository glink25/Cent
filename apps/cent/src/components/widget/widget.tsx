import { RadioGroup } from "radix-ui";
import {
    type ComponentProps,
    type CSSProperties,
    createContext,
    memo,
    useContext,
    useEffect,
    useRef,
    useState,
} from "react";
import { FORMAT_IMAGE_SUPPORTED } from "@/components/file-picker";
import { SmartImageCore } from "@/components/image";
import { nodeKey } from "./core/reconcile";
import WidgetPreviewSkeleton from "./skeleton";
import type { DSLNode } from "./type";

const themeColors: Record<string, string> = {
    "theme:surface": "var(--muted)",
    "theme:muted": "var(--muted-foreground)",
    "theme:border": "var(--border)",
    "theme:accent": "var(--primary)",
    "theme:onAccent": "var(--primary-foreground)",
    "theme:danger": "var(--destructive)",
};
function themeColor(value?: string) {
    return value && (themeColors[value] ?? value);
}

function styleToCSS(style: DSLNode["style"]): CSSProperties {
    const css: CSSProperties = {};

    if (style.fontSize) {
        css.fontSize =
            typeof style.fontSize === "number"
                ? `${style.fontSize}px`
                : style.fontSize;
    }
    if (style.color) {
        css.color = themeColor(style.color);
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
        css.background = themeColor(style.background);
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

    return {
        ...css,
        flexWrap:
            style.wrap === undefined
                ? undefined
                : style.wrap
                  ? "wrap"
                  : "nowrap",
        flexGrow: style.grow,
        flexShrink: style.shrink,
        minWidth: style.minWidth,
        maxWidth: style.maxWidth,
        minHeight: style.minHeight,
        paddingInline: style.paddingX,
        paddingBlock: style.paddingY,
        borderWidth: style.borderWidth,
        borderStyle: style.borderWidth === undefined ? undefined : "solid",
        borderColor: themeColor(style.borderColor),
        fontWeight:
            style.fontWeight === "medium"
                ? 500
                : style.fontWeight === "semibold"
                  ? 600
                  : (style.fontWeight ?? css.fontWeight),
        textAlign: style.textAlign,
    };
}

type WidgetEvent = (id: string, value?: unknown) => Promise<void> | undefined;

type Attachments = {
    pick?: (eventId: string, files: File[]) => Promise<void> | undefined;
    draft: (ref: string) => File | undefined;
    saved: (billId: string, index: number) => File | string | undefined;
};
const AttachmentContext = createContext<Attachments | undefined>(undefined);

function WidgetAttachment({ node }: { node: DSLNode }) {
    const source = useContext(AttachmentContext)?.saved(
        node.props.billId,
        node.props.index,
    );
    return source ? (
        <SmartImageCore
            source={source}
            alt={node.props.alt ?? ""}
            style={styleToCSS(node.style)}
        />
    ) : null;
}

function WidgetFilePicker({ node }: { node: DSLNode }) {
    const attachments = useContext(AttachmentContext);
    const busy = useContext(BusyContext);
    const pick = attachments?.pick;
    const eventId = node.events?.onChange;
    const [pending, setPending] = useState(false);
    if (!attachments || !pick || !eventId) return null;
    const refs: string[] = node.props.value ?? [];
    const disabled = busy || pending || Boolean(node.props.disabled);
    const select = async (files: File[]) => {
        setPending(true);
        try {
            await pick(eventId, files);
        } finally {
            setPending(false);
        }
    };
    return (
        <div className="space-y-2 text-sm" style={styleToCSS(node.style)}>
            <label className="flex flex-col gap-1">
                {node.props.label}
                <input
                    type="file"
                    accept={FORMAT_IMAGE_SUPPORTED}
                    multiple={Boolean(node.props.multiple)}
                    disabled={disabled}
                    onChange={(event) => {
                        const files = Array.from(
                            event.currentTarget.files ?? [],
                        );
                        event.currentTarget.value = "";
                        if (files.length) void select(files);
                    }}
                />
            </label>
            {refs.length > 0 && (
                <div className="flex flex-wrap items-center gap-2">
                    {refs.map((ref) => {
                        const source = attachments.draft(ref);
                        return source ? (
                            <SmartImageCore
                                key={ref}
                                source={source}
                                alt={source.name}
                                className="size-12 rounded object-cover"
                            />
                        ) : null;
                    })}
                    <button
                        type="button"
                        disabled={disabled}
                        className="rounded border px-2 py-1"
                        onClick={() => void select([])}
                    >
                        清除附件
                    </button>
                </div>
            )}
        </div>
    );
}

const BusyContext = createContext(false);

function TapButton({ onClick, ...props }: ComponentProps<"button">) {
    const busy = useContext(BusyContext);
    return (
        <button
            {...props}
            type="button"
            aria-disabled={busy || props.disabled || undefined}
            onClick={busy ? undefined : onClick}
        />
    );
}

const WidgetNode = memo(function WidgetNode({
    node,
    onEvent,
    phrasing = false,
}: {
    node: DSLNode;
    onEvent?: WidgetEvent;
    phrasing?: boolean;
}) {
    const tap = node.events?.onTap;
    if (tap && node.type !== "Button") {
        const inner = { ...node, events: { ...node.events, onTap: undefined } };
        return (
            <TapButton
                className="text-left disabled:opacity-50"
                disabled={node.props.disabled}
                onClick={() => void onEvent?.(tap)}
            >
                <WidgetNode node={inner} onEvent={onEvent} />
            </TapButton>
        );
    }
    const change = (value: unknown) => {
        return node.events?.onChange
            ? onEvent?.(node.events.onChange, value)
            : undefined;
    };
    const style = styleToCSS(node.style);

    switch (node.type) {
        case "Attachment":
            return <WidgetAttachment node={node} />;
        case "FilePicker":
            return <WidgetFilePicker node={node} />;
        case "Text":
            return (
                <span style={{ display: "inline-block", ...style }}>
                    {node.props.content}
                </span>
            );

        case "Image":
            return <img src={node.props.src} alt="" style={style} />;

        case "Flex":
        case "Container": {
            const Element = phrasing ? "span" : "div";
            return (
                <Element
                    style={{
                        display: node.type === "Flex" ? "flex" : "block",
                        ...style,
                    }}
                >
                    <WidgetChildren
                        node={node}
                        onEvent={onEvent}
                        phrasing={phrasing}
                    />
                </Element>
            );
        }

        case "Button":
            return tap ? (
                <TapButton
                    className={
                        node.children.length
                            ? "text-start focus-visible:outline-2 disabled:opacity-50"
                            : "rounded-md bg-primary text-primary-foreground px-3 py-2 text-sm disabled:opacity-50"
                    }
                    aria-label={node.props.label}
                    aria-expanded={node.props.expanded}
                    disabled={node.props.disabled}
                    onClick={() => void onEvent?.(tap)}
                    style={style}
                >
                    {node.children.length ? (
                        <WidgetChildren node={node} phrasing />
                    ) : (
                        node.props.label
                    )}
                </TapButton>
            ) : (
                <span style={style}>
                    {node.props.label ?? (
                        <WidgetChildren node={node} phrasing />
                    )}
                </span>
            );

        case "ChoiceGroup":
            return (
                <RadioGroup.Root
                    aria-label={node.props.label}
                    value={node.props.value ?? ""}
                    disabled={node.props.disabled}
                    orientation={
                        node.style.direction === "row"
                            ? "horizontal"
                            : "vertical"
                    }
                    onValueChange={change}
                    style={{
                        display: "flex",
                        flexDirection: "column",
                        ...style,
                    }}
                >
                    {node.children.map((child, index) => (
                        <RadioGroup.Item
                            key={nodeKey(child, index)}
                            aria-label={child.props.label}
                            value={child.props.value}
                            disabled={child.props.disabled}
                            className="flex items-center gap-3 rounded-md border p-2 text-start focus-visible:outline-2 disabled:opacity-50 data-[state=checked]:border-primary"
                            style={styleToCSS({
                                ...child.style,
                                ...(node.props.value === child.props.value
                                    ? child.props.selectedStyle
                                    : {}),
                            })}
                        >
                            <RadioGroup.Indicator
                                aria-hidden
                                forceMount
                                className="size-2 shrink-0 rounded-full border border-current data-[state=checked]:bg-primary"
                            />
                            <WidgetChildren node={child} phrasing />
                        </RadioGroup.Item>
                    ))}
                </RadioGroup.Root>
            );
        case "Input":
            return <WidgetInput node={node} onChange={change} />;
        case "DateTimePicker":
            return (
                <label
                    className="flex flex-col gap-1 text-sm"
                    style={styleToCSS(node.style)}
                >
                    {node.props.label}
                    <input
                        className="border rounded p-2 bg-background"
                        aria-label={node.props.accessibleLabel}
                        type="datetime-local"
                        value={
                            typeof node.props.value === "number"
                                ? new Date(
                                      node.props.value -
                                          new Date(
                                              node.props.value,
                                          ).getTimezoneOffset() *
                                              60000,
                                  )
                                      .toISOString()
                                      .slice(0, 16)
                                : (node.props.value ?? "")
                        }
                        onChange={(e) => {
                            if (e.target.value)
                                change(new Date(e.target.value).getTime());
                        }}
                        disabled={node.props.disabled}
                    />
                </label>
            );
        case "Switch":
            return (
                <label className="flex items-center gap-2" style={style}>
                    <input
                        type="checkbox"
                        aria-label={node.props.accessibleLabel}
                        role="switch"
                        aria-checked={Boolean(node.props.value)}
                        checked={Boolean(node.props.value)}
                        onChange={(e) => change(e.target.checked)}
                        disabled={node.props.disabled}
                    />
                    {node.props.label}
                </label>
            );
        case "Select":
            return (
                <label
                    className="flex flex-col gap-1 text-sm"
                    style={styleToCSS(node.style)}
                >
                    {node.props.label}
                    <select
                        aria-label={
                            node.props.accessibleLabel ?? node.props.label
                        }
                        className="border rounded p-2 bg-background"
                        multiple={Boolean(node.props.multiple)}
                        value={
                            node.props.value ?? (node.props.multiple ? [] : "")
                        }
                        disabled={node.props.disabled}
                        onChange={(e) =>
                            change(
                                node.props.multiple
                                    ? Array.from(
                                          e.target.selectedOptions,
                                          (o) => o.value,
                                      )
                                    : e.target.value,
                            )
                        }
                    >
                        {!node.props.multiple && <option value="">—</option>}
                        {(node.props.options ?? []).map(
                            (
                                option:
                                    | string
                                    | { value: string; label: string },
                            ) => {
                                const value =
                                    typeof option === "string"
                                        ? option
                                        : option.value;
                                return (
                                    <option key={value} value={value}>
                                        {typeof option === "string"
                                            ? option
                                            : option.label}
                                    </option>
                                );
                            },
                        )}
                    </select>
                </label>
            );
        case "Line":
            return (
                <svg
                    role="img"
                    aria-label={node.props.label ?? "Chart"}
                    viewBox={node.props.viewBox ?? "0 0 100 100"}
                    style={{ width: "100%", ...style }}
                >
                    <polyline
                        points={(node.props.points ?? [])
                            .map((p: number[]) => p.join(","))
                            .join(" ")}
                        fill="none"
                        stroke={node.props.color ?? "currentColor"}
                        strokeWidth={node.props.strokeWidth ?? 1}
                    />
                </svg>
            );
        default:
            return null;
    }
});

function WidgetChildren({
    node,
    onEvent,
    phrasing,
}: {
    node: DSLNode;
    onEvent?: WidgetEvent;
    phrasing?: boolean;
}) {
    return node.children.map((child, index) => (
        <WidgetNode
            key={nodeKey(child, index)}
            node={child}
            onEvent={onEvent}
            phrasing={phrasing}
        />
    ));
}

type WidgetRendererProps = {
    dsl: DSLNode | null | undefined;
    className?: string;
    attachments?: Attachments;
    onEvent?: WidgetEvent;
    busy?: boolean;
};

export default function WidgetRenderer({
    dsl,
    className,
    attachments,
    onEvent,
    busy,
}: WidgetRendererProps) {
    if (!dsl) return <WidgetPreviewSkeleton className={className} />;

    return (
        <div className={className}>
            <AttachmentContext.Provider value={attachments}>
                <BusyContext.Provider value={Boolean(busy)}>
                    <WidgetNode
                        key={nodeKey(dsl, 0)}
                        node={dsl}
                        onEvent={onEvent}
                    />
                </BusyContext.Provider>
            </AttachmentContext.Provider>
        </div>
    );
}

function WidgetInput({
    node,
    onChange,
}: {
    node: DSLNode;
    onChange: (value: string) => Promise<void> | undefined;
}) {
    const [draft, setDraft] = useState(String(node.props.value ?? ""));
    const [settled, setSettled] = useState(0);
    const revision = useRef(0);
    useEffect(() => {
        if (revision.current === settled)
            setDraft(String(node.props.value ?? ""));
    }, [node.props.value, settled]);
    return (
        <label
            className="flex flex-col gap-1 text-sm"
            style={styleToCSS(node.style)}
        >
            {node.props.label}
            <input
                aria-label={node.props.accessibleLabel}
                className="border rounded p-2 bg-background"
                type={node.props.type === "password" ? "password" : "text"}
                inputMode={
                    node.props.type === "decimal" ||
                    node.props.type === "number"
                        ? "decimal"
                        : "text"
                }
                value={draft}
                placeholder={node.props.placeholder}
                disabled={node.props.disabled}
                onChange={(e) => {
                    setDraft(e.target.value);
                    const next = ++revision.current;
                    void Promise.resolve(onChange(e.target.value)).then(() => {
                        if (revision.current === next) setSettled(next);
                    });
                }}
            />
        </label>
    );
}
