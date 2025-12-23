import { v4 } from "uuid";
import { useTag } from "@/hooks/use-tag";
import PopupLayout from "@/layouts/popup-layout";
import type { BillTagGroup } from "@/ledger/type";
import { useIntl } from "@/locale";
import { cn } from "@/utils";
import Tag from "../tag";
import { Button } from "../ui/button";
import { type EditTag, EditTagProvider, showEditTag } from "./tag";
import { EditTagGroupProvider, showEditTagGroup } from "./tag-group";

export default function TagList({
    onCancel,
}: {
    edit?: any;
    onCancel?: () => void;
    onConfirm?: (v: any) => void;
}) {
    const t = useIntl();
    const { updateTag, grouped, updateGroup, topUpGroup } = useTag();

    const toUpdateTagGroup = async (group?: BillTagGroup) => {
        const newGroup = await showEditTagGroup(group);
        if (newGroup === "delete") {
            if (group?.id) {
                updateGroup(group?.id, undefined);
            }
            return;
        }
        await updateGroup(group?.id ?? v4(), newGroup);
    };

    const toUpdateTag = async (tag?: EditTag) => {
        const newTag = await showEditTag(tag);
        if (newTag === "delete") {
            if (tag?.id) {
                updateTag(tag?.id, undefined);
            }
            return;
        }
        await updateTag(tag?.id ?? v4(), newTag);
    };

    return (
        <PopupLayout
            onBack={onCancel}
            title={t("edit-tags")}
            right={
                <div className="flex items-center gap-2">
                    <Button onClick={() => toUpdateTag()} variant="secondary">
                        <i className="icon-[mdi--tag-plus-outline]"></i>
                    </Button>

                    <Button onClick={() => toUpdateTagGroup()}>
                        {t("add-new-tag-group")}
                    </Button>
                </div>
            }
        >
            <div className="flex items-center justify-between px-2">
                <div className="px-2 text-xs text-foreground/80">
                    {t("click-tag-to-edit")}
                </div>
            </div>
            <div className="flex flex-wrap items-center p-2 gap-2">
                {grouped.map((group) => {
                    return (
                        <div
                            key={group.id}
                            className="border rounded-md w-full text-sm"
                        >
                            <div
                                className={cn(
                                    "flex justify-between items-center with-tag-color px-2 py-1 rounded-t-md bg-[var(--current-tag-color)]",
                                    `tag-${group.color}`,
                                )}
                            >
                                <div className="">
                                    {group.id === "un-group"
                                        ? t("un-grouped")
                                        : group.name}
                                </div>
                                <div className="flex items-center gap-1">
                                    {group.id !== "un-group" && (
                                        <>
                                            <Button
                                                variant="ghost"
                                                size={"sm"}
                                                onClick={() =>
                                                    toUpdateTagGroup(group)
                                                }
                                            >
                                                <i className="icon-[mdi--settings]"></i>
                                            </Button>

                                            <Button
                                                size={"sm"}
                                                variant="ghost"
                                                onClick={() =>
                                                    topUpGroup(group.id)
                                                }
                                            >
                                                <i className="icon-[mdi--arrow-collapse-up]"></i>
                                            </Button>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-wrap items-center p-2 gap-2">
                                {group.tags.map((tag) => (
                                    <Tag
                                        key={tag.id}
                                        className="gap-1 cursor-grab active:cursor-grabbing"
                                        onClick={() => toUpdateTag(tag)}
                                    >
                                        <span>#{tag.name}</span>
                                    </Tag>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
            <EditTagProvider />
            <EditTagGroupProvider />
        </PopupLayout>
    );
}
