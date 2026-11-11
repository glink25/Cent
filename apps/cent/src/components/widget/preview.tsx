import type { Bill } from "@/ledger/type";
import { useIntl } from "@/locale";
import compileWidget from "./core/compile";
import InteractiveWidget from "./interactive";
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
    const t = useIntl();
    if (!compileWidget(widget.code).apiVersion.startsWith("2.")) {
        return <p className="p-3 text-xs">{t("widget-upgrade-required")}</p>;
    }
    return (
        <InteractiveWidget
            key={`${widget.id}:${widget.code}`}
            widget={widget}
            bills={bills}
            className={className}
            initialView={initialView}
        />
    );
}
