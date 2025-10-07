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

export type SortableItem = {
	id: string | number;
	name: string;
};

function SortableListItem({ id, name }: SortableItem) {
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
	};

	return (
		<div
			ref={setNodeRef}
			style={style}
			{...attributes}
			{...listeners}
			className="bg-white border rounded-md p-2 shadow-sm active:cursor-grabbing flex items-center justify-between"
		>
			<div>{name}</div>
			<i className="icon-[mdi--reorder-horizontal]"></i>
		</div>
	);
}

/**
 * 一个支持滚动、拖拽排序的通用列表组件
 */
export const SortableList = <T extends SortableItem>({
	items,
	onReorder,
	className,
}: {
	items: T[];
	onReorder: (v: T[]) => void;
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
						<SortableListItem key={item.id} {...item} />
					))}
				</div>
			</SortableContext>
		</DndContext>
	);
};
