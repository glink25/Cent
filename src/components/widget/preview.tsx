import WidgetPreviewWrapper from "./preview-wrapper";
import type { Widget } from "./type";

type WidgetPreviewProps = {
    widget: Widget;
    className?: string;
};

export default function WidgetPreview({
    widget,
    className,
}: WidgetPreviewProps) {
    return (
        <WidgetPreviewWrapper
            code={widget.code}
            settings={widget.settings}
            className={className}
        />
    );
}
