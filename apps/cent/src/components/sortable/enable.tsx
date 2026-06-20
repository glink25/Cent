import {
    closestCenter,
    DndContext,
    type DragEndEvent,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
    arrayMove,
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";
import { Switch } from "../ui/switch";

export type SortableEnableItem = {
    id: string | number;
    name: string;
    enable: boolean;
    freeze?: boolean;
};

function SortableListItemWithEnable({
    id,
    name,
    enable,
    freeze,
    onToggleEnable,
}: SortableEnableItem & { onToggleEnable: (id: string | number) => void }) {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        cursor: "grab",
        userSelect: "none",
        touchAction: "none",
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className="bg-background border rounded-md p-2 shadow-sm active:cursor-grabbing flex items-center justify-between gap-2"
        >
            <div className="flex-1 min-w-0 truncate">{name}</div>
            <div className="flex items-center gap-2 shrink-0">
                <Switch
                    checked={enable}
                    disabled={freeze}
                    onCheckedChange={() => onToggleEnable(id)}
                    onPointerDown={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    onTouchStart={(e) => e.stopPropagation()}
                />
                <i className="icon-[mdi--reorder-horizontal]"></i>
            </div>
        </div>
    );
}

export const SortableListWithEnable = <T extends SortableEnableItem>({
    items,
    onReorder,
    onToggleEnable,
    className,
}: {
    items: T[];
    onReorder: (v: T[]) => void;
    onToggleEnable: (id: string | number) => void;
    className?: string;
}) => {
    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 100, tolerance: 5 },
        }),
        useSensor(KeyboardSensor),
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const newItems = arrayMove(items, oldIndex, newIndex);
        onReorder(newItems);
    };

    return (
        <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
        >
            <SortableContext
                items={items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div
                    className={`overflow-y-auto max-h-[400px] flex flex-col gap-2 ${className || ""}`}
                >
                    {items.map((item) => (
                        <SortableListItemWithEnable
                            key={item.id}
                            {...item}
                            onToggleEnable={onToggleEnable}
                        />
                    ))}
                </div>
            </SortableContext>
        </DndContext>
    );
};

function FormWithEnable<T extends SortableEnableItem>({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: T[];
    onConfirm?: (v: T[]) => void;
    onCancel?: () => void;
}) {
    const [list, setList] = useState([...(edit ?? [])]);
    const onReorder: typeof setList = useCallback((v) => {
        setList(v);
    }, []);
    const onToggleEnable = useCallback((id: string | number) => {
        setList((prev) =>
            prev.map((item) =>
                item.id === id ? { ...item, enable: !item.enable } : item,
            ),
        );
    }, []);
    const t = useIntl();
    return (
        <PopupLayout
            title={t("sort")}
            onBack={onCancel}
            right={
                <Button
                    onClick={() => {
                        onConfirm?.(list);
                    }}
                >
                    {t("confirm")}
                </Button>
            }
            className="h-full overflow-hidden"
        >
            <div className="flex-1 w-full overflow-hidden py-2">
                <SortableListWithEnable
                    items={list}
                    onReorder={onReorder}
                    onToggleEnable={onToggleEnable}
                    className="h-full max-h-full px-2"
                />
            </div>
        </PopupLayout>
    );
}

export const [SortableListWithEnableProvider, showSortableAndEnable] =
    createConfirmProvider(FormWithEnable as any, {
        dialogTitle: "Sort",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[min(520px,calc(100vh-32px))] sm:w-[90vw] sm:max-w-[500px]",
    }) as unknown as [
        () => ReactNode,
        <T extends SortableEnableItem>(value?: T[]) => Promise<T[]>,
    ];
