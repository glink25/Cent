import type { Bill } from "@/ledger/type";
import WidgetPreviewWrapper from "./preview-wrapper";
import type { Widget } from "./type";

type WidgetPreviewProps = {
    widget: Widget;
    className?: string;
    bills?: Bill[];
};

export default function WidgetPreview({
    widget,
    className,
    bills,
}: WidgetPreviewProps) {
    return (
        <WidgetPreviewWrapper
            code={widget.code}
            settings={widget.settings}
            className={className}
            bills={bills}
        />
    );
}
