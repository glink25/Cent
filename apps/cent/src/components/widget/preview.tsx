import type { Bill } from "@/ledger/type";
import compileWidget from "./core/compile";
import InteractiveWidget from "./interactive";
import WidgetPreviewWrapper from "./preview-wrapper";
import type { Widget } from "./type";

type WidgetPreviewProps = {
    widget: Widget;
    className?: string;
    bills?: Bill[];
    initialView?: string;
};

export default function WidgetPreview({
    widget,
    className,
    bills,
    initialView,
}: WidgetPreviewProps) {
    if (compileWidget(widget.code).apiVersion.startsWith("2."))
        return (
            <InteractiveWidget
                key={`${widget.id}:${widget.code}`}
                widget={widget}
                bills={bills}
                className={className}
                initialView={initialView}
            />
        );
    return (
        <WidgetPreviewWrapper
            code={widget.code}
            settings={widget.settings}
            grants={widget.permissions}
            className={className}
            bills={bills}
        />
    );
}
