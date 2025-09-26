"use client";

import { useTag } from "@/hooks/use-tag";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import Tag from "../tag";
import { toast } from "sonner";
import Deletable from "../deletable";

import {
	DndContext,
	closestCenter,
	KeyboardSensor,
	PointerSensor,
	TouchSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	arrayMove,
	SortableContext,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { restrictToParentElement } from "@dnd-kit/modifiers";

function SortableTag({ tag, onDelete, onEdit }: any) {
	const {
		attributes,
		listeners,
		setNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id: tag.id });

	const style = {
		transform: CSS.Transform.toString(transform),
		transition,
		opacity: isDragging ? 0.5 : 1,
	};

	return (
		<div ref={setNodeRef} style={style} {...attributes} {...listeners}>
			<Deletable onDelete={onDelete}>
				<Tag
					className="gap-1 cursor-grab active:cursor-grabbing"
					onClick={onEdit}
				>
					<span>#{tag.name}</span> <i className="icon-[mdi--edit-outline]" />
				</Tag>
			</Deletable>
		</div>
	);
}

export default function TagList({
	onCancel,
}: {
	edit?: any;
	onCancel?: () => void;
	onConfirm?: (v: any) => void;
}) {
	const t = useIntl();
	const {
		tags,
		update: updateTag,
		add: addTag,
		reorder: reorderTags,
	} = useTag();

	// 定义拖拽传感器（鼠标 + 触控 + 键盘）
	const sensors = useSensors(
		useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
		useSensor(TouchSensor, {
			activationConstraint: { delay: 100, tolerance: 5 },
		}),
		useSensor(KeyboardSensor),
	);

	function handleDragEnd(event: any) {
		const { active, over } = event;
		if (active.id !== over?.id) {
			const oldIndex = tags.findIndex((t) => t.id === active.id);
			const newIndex = tags.findIndex((t) => t.id === over.id);
			const newOrder = arrayMove(tags, oldIndex, newIndex);
			reorderTags(newOrder); // 需要在 useTag 里实现 reorder 保存逻辑
		}
	}

	return (
		<PopupLayout onBack={onCancel} title={t("edit-tags")}>
			<DndContext
				sensors={sensors}
				collisionDetection={closestCenter}
				onDragEnd={handleDragEnd}
				modifiers={[restrictToParentElement]}
			>
				<SortableContext items={tags} strategy={verticalListSortingStrategy}>
					<div className="flex flex-wrap items-center p-2 gap-2">
						{tags.map((tag) => (
							<SortableTag
								key={tag.id}
								tag={tag}
								onDelete={() => {
									const ok = confirm(t("sure-to-delete-this-tag"));
									if (!ok) return;
									updateTag(tag.id, undefined);
								}}
								onEdit={async () => {
									try {
										const tagName = prompt(t("input-new-tag-name"));
										if (!tagName) return;
										await updateTag(tag.id, { name: tagName });
									} catch (error) {
										toast.error((error as any).message);
									}
								}}
							/>
						))}
						<button
							type="button"
							className={cn(
								`rounded-lg border py-1 px-2 my-1 mr-1 h-8 flex gap-2 items-center justify-center whitespace-nowrap cursor-pointer`,
							)}
							onClick={async () => {
								try {
									const tagName = prompt("input tag name");
									if (!tagName) return;
									await addTag({ name: tagName });
								} catch (error) {
									toast.error((error as any).message);
								}
							}}
						>
							<i className="icon-[mdi--tag-plus-outline]"></i>
							{t("add-tag")}
						</button>
					</div>
				</SortableContext>
			</DndContext>
		</PopupLayout>
	);
}
