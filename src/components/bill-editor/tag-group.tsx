import { useEffect, useRef } from "react";
import { type BillTagGroupDetail, useTag } from "@/hooks/use-tag";
import { cn } from "@/utils";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

function TagGroup({
    selected,
    group,
    onSelectChange,
}: {
    selected: string[];
    group: BillTagGroupDetail;
    onSelectChange: (v: string[], extra?: { preferCurrency?: string }) => void;
}) {
    const groupSelected = group.tags.filter((tag) => selected.includes(tag.id));
    const formatValue =
        groupSelected.length === 0
            ? group.name
            : groupSelected.length === 1
              ? `#${groupSelected[0].name}`
              : `#${groupSelected[0].name} +${groupSelected.length - 1}`;
    return (
        <DropdownMenu>
            <DropdownMenuTrigger>
                <div
                    className={cn(
                        "flex items-center justify-center gap-2 with-tag-color border border-input px-2 py-1 rounded-md",
                        `tag-${group.color}`,
                    )}
                >
                    <div
                        className={cn(
                            "w-3 h-3 bg-[var(--current-tag-color)] rounded-full",
                        )}
                    ></div>
                    <div
                        className={`${groupSelected.length > 0 ? "text-[var(--current-tag-color)]" : ""}`}
                    >
                        {formatValue}
                    </div>
                </div>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
                {group.tags.map((tag) => {
                    return (
                        <DropdownMenuCheckboxItem
                            key={tag.id}
                            checked={selected.includes(tag.id)}
                            onCheckedChange={(checked) => {
                                if (checked) {
                                    if (group.singleSelect) {
                                        onSelectChange(
                                            [
                                                ...selected.filter(
                                                    (v) =>
                                                        !group.tagIds?.includes(
                                                            v,
                                                        ),
                                                ),
                                                tag.id,
                                            ],
                                            tag.preferCurrency
                                                ? {
                                                      preferCurrency:
                                                          tag.preferCurrency,
                                                  }
                                                : undefined,
                                        );
                                        return;
                                    }
                                    onSelectChange(
                                        [...selected, tag.id],
                                        tag.preferCurrency
                                            ? {
                                                  preferCurrency:
                                                      tag.preferCurrency,
                                              }
                                            : undefined,
                                    );
                                    return;
                                }
                                // 如果标签组设置了必选，则至少选中一个标签
                                if (
                                    group.required &&
                                    groupSelected.length === 1
                                ) {
                                    return;
                                }
                                onSelectChange(
                                    selected.filter((v) => v !== tag.id),
                                );
                            }}
                        >
                            #{tag.name}
                        </DropdownMenuCheckboxItem>
                    );
                })}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

export default function TagGroupSelector({
    selectedTags,
    onSelectChange,
    isCreate,
}: {
    selectedTags?: string[];
    onSelectChange: (v: string[], extra?: { preferCurrency?: string }) => void;
    isCreate: boolean;
}) {
    const { grouped } = useTag();

    // 进入记账页面后自动选中标签
    const autoSelect = () => {
        if (selectedTags === undefined && isCreate) {
            const defaultTags = grouped
                .filter((v) => v.required)
                .map((v) => v.tags?.[0])
                .filter((v) => v !== undefined);
            const preferCurrency = defaultTags.findLast(
                (v) => v.preferCurrency !== undefined,
            )?.preferCurrency;
            onSelectChange(
                defaultTags.map((v) => v.id),
                preferCurrency ? { preferCurrency } : undefined,
            );
        }
    };
    const autoSelectRef = useRef(autoSelect);
    autoSelectRef.current = autoSelect;
    useEffect(() => {
        autoSelectRef.current();
    }, []);

    return (
        <>
            {grouped
                .filter((group) => group.tags.length > 0)
                .map((group) => (
                    <TagGroup
                        key={group.id}
                        group={group}
                        selected={selectedTags ?? []}
                        onSelectChange={onSelectChange}
                    ></TagGroup>
                ))}
        </>
    );
}
