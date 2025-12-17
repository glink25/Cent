import {
    closestCenter,
    closestCorners,
    DndContext,
    type DragEndEvent,
    type DragOverEvent,
    DragOverlay,
    type DragStartEvent,
    type DropAnimation,
    defaultDropAnimationSideEffects,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    type UniqueIdentifier,
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
import type React from "react";
import { type ReactNode, useCallback, useMemo, useState } from "react";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import createConfirmProvider from "../confirm";
import { Button } from "../ui/button";

// --- 类型定义 ---

export type SortableItem = {
    id: UniqueIdentifier;
    label: ReactNode;
};

export type SortableGroupData = {
    id: UniqueIdentifier;
    label: ReactNode;
    items: SortableItem[];
    empty?: ReactNode;
};

// --- 子组件：单个列表项 (保持原有风格) ---

function SortableListItem({
    id,
    label,
    isOverlay,
}: SortableItem & { isOverlay?: boolean }) {
    const t = useIntl();
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
        opacity: isDragging ? 0.3 : 1, // 拖拽时源位置变淡
        cursor: isOverlay ? "grabbing" : "grab",
        userSelect: "none",
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`bg-background border rounded-md p-2 shadow-sm flex items-center justify-between 
                ${isOverlay ? "shadow-xl ring-2 ring-primary/20 scale-[1.02]" : "active:cursor-grabbing"}
            `}
        >
            <div>{label}</div>
            <i className="icon-[mdi--reorder-horizontal] text-muted-foreground"></i>
        </div>
    );
}

// --- 子组件：列表容器 (Group) ---

interface GroupProps {
    group: SortableGroupData;
    isGroupSortable: boolean;
}

function SortableGroupContainer({ group, isGroupSortable }: GroupProps) {
    const t = useIntl();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({
        id: group.id,
        data: {
            type: "group",
            group,
        },
        disabled: !isGroupSortable, // 控制是否允许拖动整个组
    });

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="bg-gray-50/50 dark:bg-gray-900/20 border rounded-lg p-3 flex flex-col gap-2"
        >
            {/* Group Header */}
            <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-sm text-foreground/80 pl-1">
                    {group.label}
                </span>
                {isGroupSortable && (
                    <button
                        {...attributes}
                        {...listeners}
                        className="p-1 hover:bg-gray-200 dark:hover:bg-gray-800 rounded cursor-grab active:cursor-grabbing"
                    >
                        <i className="icon-[mdi--reorder-horizontal] block"></i>
                    </button>
                )}
            </div>

            {/* Items Context */}
            <SortableContext
                items={group.items.map((i) => i.id)}
                strategy={verticalListSortingStrategy}
            >
                <div className="flex flex-col gap-2 min-h-[50px]">
                    {group.items.length === 0 && (
                        <div className="text-xs text-muted-foreground text-center py-4 border border-dashed rounded">
                            {group.empty ?? t("group-no-items")}
                        </div>
                    )}
                    {group.items.map((item) => (
                        <SortableListItem key={item.id} {...item} />
                    ))}
                </div>
            </SortableContext>
        </div>
    );
}

// --- 主组件：SortableGroup ---

interface SortableGroupProps {
    groups: SortableGroupData[];
    onGroupsChange: (groups: SortableGroupData[]) => void;
    enableGroupSorting?: boolean;
    className?: string;
    empty?: ReactNode;
}

export const SortableGroup = ({
    groups,
    onGroupsChange,
    enableGroupSorting = false,
    className,
    empty,
}: SortableGroupProps) => {
    const [activeId, setActiveId] = useState<UniqueIdentifier | null>(null);
    const [activeItem, setActiveItem] = useState<SortableItem | null>(null);
    const [activeGroup, setActiveGroup] = useState<SortableGroupData | null>(
        null,
    );

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 100, tolerance: 5 },
        }),
        useSensor(KeyboardSensor),
    );

    // 辅助函数：查找 ID 所在的容器（Group ID）
    const findContainer = (id: UniqueIdentifier) => {
        if (groups.find((g) => g.id === id)) return id;
        return groups.find((g) => g.items.some((i) => i.id === id))?.id;
    };

    const handleDragStart = (event: DragStartEvent) => {
        const { active } = event;
        const id = active.id;
        setActiveId(id);

        const group = groups.find((g) => g.id === id);
        if (group) {
            setActiveGroup(group);
            return;
        }

        const flatItems = groups.flatMap((g) => g.items);
        const item = flatItems.find((i) => i.id === id);
        if (item) setActiveItem(item);
    };

    const handleDragOver = (event: DragOverEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        // 如果是拖动 Group 或者没有 Over 对象，不做处理
        if (!overId || activeGroup) return;

        // 处理 Item 的跨列表移动逻辑
        const activeContainer = findContainer(active.id);
        const overContainer = findContainer(overId);

        if (
            !activeContainer ||
            !overContainer ||
            activeContainer === overContainer
        ) {
            return;
        }

        // 产生新的数据结构（在拖拽过程中实时更新 UI）
        const activeGroupIdx = groups.findIndex(
            (g) => g.id === activeContainer,
        );
        const overGroupIdx = groups.findIndex((g) => g.id === overContainer);

        const newGroups = [...groups];
        const activeItems = [...newGroups[activeGroupIdx].items];
        const overItems = [...newGroups[overGroupIdx].items];

        const activeItemIdx = activeItems.findIndex((i) => i.id === active.id);
        const overItemIdx = overItems.findIndex((i) => i.id === overId);

        let newIndex: number | undefined;
        if (overItemIdx === -1) {
            // 拖到了容器本身，放在最后
            newIndex = overItems.length + 1;
        } else {
            // 简单的插入逻辑，根据拖拽方向微调可使用 rectIntersection，这里简化为索引操作
            const isBelowOverItem =
                over &&
                active.rect.current.translated &&
                active.rect.current.translated.top >
                    over.rect.top + over.rect.height;

            const modifier = isBelowOverItem ? 1 : 0;
            newIndex =
                overItemIdx >= 0
                    ? overItemIdx + modifier
                    : overItems.length + 1;
        }

        // 移动 Item
        const [movedItem] = activeItems.splice(activeItemIdx, 1);
        overItems.splice(newIndex, 0, movedItem);

        newGroups[activeGroupIdx] = {
            ...newGroups[activeGroupIdx],
            items: activeItems,
        };
        newGroups[overGroupIdx] = {
            ...newGroups[overGroupIdx],
            items: overItems,
        };

        onGroupsChange(newGroups);
    };

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        const overId = over?.id;

        // 1. 处理 Group 排序
        if (activeGroup && overId && active.id !== overId) {
            const oldIndex = groups.findIndex((g) => g.id === active.id);
            const newIndex = groups.findIndex((g) => g.id === overId);
            onGroupsChange(arrayMove(groups, oldIndex, newIndex));
        }

        // 2. 处理 Item 排序 (同组内)
        // 跨组移动已经在 DragOver 中处理完了，这里主要处理同一个组内的重新排序
        if (!activeGroup && overId) {
            const activeContainer = findContainer(active.id);
            const overContainer = findContainer(overId);

            if (
                activeContainer &&
                overContainer &&
                activeContainer === overContainer
            ) {
                const groupIndex = groups.findIndex(
                    (g) => g.id === activeContainer,
                );
                const oldIndex = groups[groupIndex].items.findIndex(
                    (i) => i.id === active.id,
                );
                const newIndex = groups[groupIndex].items.findIndex(
                    (i) => i.id === overId,
                );

                if (oldIndex !== newIndex) {
                    const newGroups = [...groups];
                    newGroups[groupIndex] = {
                        ...newGroups[groupIndex],
                        items: arrayMove(
                            newGroups[groupIndex].items,
                            oldIndex,
                            newIndex,
                        ),
                    };
                    onGroupsChange(newGroups);
                }
            }
        }

        setActiveId(null);
        setActiveItem(null);
        setActiveGroup(null);
    };

    const dropAnimation: DropAnimation = {
        sideEffects: defaultDropAnimationSideEffects({
            styles: {
                active: { opacity: "0.5" },
            },
        }),
    };

    return (
        <DndContext
            sensors={sensors}
            // 使用 closestCorners 对多容器、不同高度的列表更友好
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
            modifiers={[restrictToVerticalAxis]}
        >
            <div className={`flex flex-col gap-4 ${className || ""}`}>
                <SortableContext
                    items={groups.map((g) => g.id)}
                    strategy={verticalListSortingStrategy}
                >
                    {groups.map((group) => (
                        <SortableGroupContainer
                            key={group.id}
                            group={group}
                            isGroupSortable={enableGroupSorting}
                        />
                    ))}
                </SortableContext>
            </div>

            {/* 拖拽时的浮层，提升用户体验 */}
            <DragOverlay dropAnimation={dropAnimation}>
                {activeId ? (
                    activeGroup ? (
                        // 拖拽 Group 时的样式
                        <div className="opacity-90 rotate-2 cursor-grabbing">
                            <SortableGroupContainer
                                group={activeGroup}
                                isGroupSortable={true}
                            />
                        </div>
                    ) : (
                        // 拖拽 Item 时的样式
                        <SortableListItem
                            id={activeItem!.id}
                            label={activeItem!.label}
                            isOverlay
                        />
                    )
                ) : null}
            </DragOverlay>
        </DndContext>
    );
};

function Form({
    edit,
    onCancel,
    onConfirm,
}: {
    edit?: { group: SortableGroupData[]; enableGroupSorting?: boolean };
    onConfirm?: (v: SortableGroupData[]) => void;
    onCancel?: () => void;
}) {
    const [list, setList] = useState([...(edit?.group ?? [])]);
    const onReorder: typeof setList = useCallback((v) => {
        setList(v);
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
            <div className="flex-1 w-full overflow-y-auto py-2">
                <SortableGroup
                    groups={list}
                    onGroupsChange={onReorder}
                    enableGroupSorting={edit?.enableGroupSorting}
                    className="h-full max-h-full px-2"
                />
            </div>
        </PopupLayout>
    );
}

export const [SortableGroupProvider, showSortableGroup] = createConfirmProvider(
    Form as any,
    {
        dialogTitle: "Sort Group",
        dialogModalClose: true,
        contentClassName:
            "h-full w-full max-h-full max-w-full rounded-none sm:rounded-md sm:max-h-[55vh] sm:w-[90vw] sm:max-w-[500px]",
    },
) as [
    () => ReactNode,
    <T extends SortableGroupData>(value?: {
        group: T[];
        enableGroupSorting?: boolean;
    }) => Promise<T[]>,
];
