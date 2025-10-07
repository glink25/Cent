import { useTag } from "@/hooks/use-tag";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import Tag from "../tag";
import { toast } from "sonner";
import Deletable from "../deletable";
import { Button } from "../ui/button";
import { showSortableList } from "../sortable";

function SortableTag({ tag, onDelete, onEdit }: any) {
	return (
		<Deletable onDelete={onDelete}>
			<Tag
				className="gap-1 cursor-grab active:cursor-grabbing"
				onClick={onEdit}
			>
				<span>#{tag.name}</span>
			</Tag>
		</Deletable>
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

	return (
		<PopupLayout onBack={onCancel} title={t("edit-tags")}>
			<div className="flex items-center justify-between px-2">
				<div className="px-2 text-xs text-foreground/80">
					{t("click-tag-to-edit")}
				</div>
				<Button
					variant="ghost"
					className="p-1 h-fit"
					onClick={async () => {
						const ordered = await showSortableList(tags);
						reorderTags(ordered);
					}}
				>
					<i className="icon-[mdi--reorder-horizontal]"></i>
				</Button>
			</div>
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
		</PopupLayout>
	);
}
