import { useWidget } from "@/hooks/use-widget";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import modal from "../modal";
import { showSortableList } from "../sortable";
import { Button } from "../ui/button";
import { showWidgetEdit } from "./edit-form";
import WidgetPreview from "./preview";

export default function WidgetList({ onCancel }: { onCancel?: () => void }) {
    const t = useIntl();
    const { widgets, remove, reorder } = useWidget();

    return (
        <PopupLayout onBack={onCancel} title={t("widget-settings")}>
            <div className="flex items-center justify-between px-2">
                <div className="px-2 text-xs text-foreground/80">
                    {t("widget-description")}
                </div>
                {widgets.length > 0 && (
                    <Button
                        variant="ghost"
                        className="p-1 h-fit"
                        onClick={async () => {
                            const ordered = await showSortableList(
                                widgets.map((w) => ({
                                    id: w.id,
                                    name: w.name,
                                })),
                            );
                            await reorder(ordered.map((o) => o.id));
                        }}
                    >
                        <i className="icon-[mdi--reorder-horizontal]"></i>
                    </Button>
                )}
            </div>
            <div className="w-full flex-1 overflow-y-auto flex flex-col gap-2 p-2">
                <Button
                    variant="outline"
                    onClick={async () => {
                        await showWidgetEdit();
                    }}
                >
                    <i className="icon-[mdi--add]" />
                    {t("add-widget")}
                </Button>
                {widgets.map((widget) => (
                    <div
                        key={widget.id}
                        className="border rounded-md shadow-md py-4 px-4 bg-card flex flex-col gap-2"
                    >
                        <div className="flex items-center justify-between">
                            <div className="font-medium">{widget.name}</div>
                            <div className="flex items-center gap-2">
                                <div className="text-xs opacity-60">
                                    {widget.permissions.join(", ")}
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="w-[24px] h-[24px] text-xs p-0"
                                    onClick={async () => {
                                        await showWidgetEdit(widget);
                                    }}
                                >
                                    <i className="icon-[mdi--edit-outline]" />
                                </Button>
                                <Button
                                    variant="destructive"
                                    className="w-[24px] h-[24px] p-0"
                                    onClick={async () => {
                                        await modal.prompt({
                                            title: t(
                                                "are-you-sure-to-delete-this-widget",
                                            ),
                                        });
                                        await remove(widget.id);
                                    }}
                                >
                                    <i className="icon-[mdi--delete]" />
                                </Button>
                            </div>
                        </div>
                        <div className="h-[120px] w-full bg-card rounded-lg shadow overflow-hidden border py-2">
                            <WidgetPreview widget={widget} />
                        </div>
                    </div>
                ))}
            </div>
        </PopupLayout>
    );
}
