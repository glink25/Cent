/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
import {
    type ReactNode,
    useCallback,
    useEffect,
    useRef,
    useState,
} from "react";
import { type BillTagGroupDetail, useTag } from "@/hooks/use-tag";
import { cn } from "@/utils";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuTrigger,
} from "../ui/dropdown-menu";

function TagTrigger({
    children,
    selected,
    color,
    onClick,
}: {
    children?: ReactNode;
    selected?: boolean;
    color?: string;
    onClick?: () => void;
}) {
    return (
        <div
            onPointerDown={(e) => {
                e.preventDefault();
            }}
            onClick={onClick}
            className={cn(
                "flex flex-shrink-0 items-center justify-center gap-2 with-tag-color border border-input px-2 py-1 rounded-md cursor-pointer",
                `tag-${color}`,
            )}
        >
            <div
                className={cn(
                    "w-3 h-3 bg-[var(--current-tag-color)] rounded-full",
                    selected ? "" : "opacity-40",
                )}
            ></div>
            <div
                className={`${selected ? "text-[var(--current-tag-color)]" : "opacity-40"}`}
            >
                {children}
            </div>
        </div>
    );
}

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

    const [open, setOpen] = useState(false);
    // 如果标签组只包含一个标签，那么无需展开弹窗，可以点击直接选中/取消选中该标签
    if (group.tagIds?.length === 1) {
        const singleTagId = group.tagIds[0];
        const selected = groupSelected.some((v) => v.id === singleTagId);
        return (
            <TagTrigger
                color={group.color}
                selected={selected}
                onClick={() => {
                    if (selected) {
                        onSelectChange(
                            group.tagIds?.filter((v) => v !== singleTagId) ??
                                [],
                        );
                    } else {
                        onSelectChange([...(group.tagIds ?? []), singleTagId]);
                    }
                }}
            >
                {formatValue}
            </TagTrigger>
        );
    }
    return (
        <DropdownMenu open={open} onOpenChange={setOpen}>
            <DropdownMenuTrigger className="flex-shrink-0">
                <TagTrigger
                    color={group.color}
                    selected={groupSelected.length > 0}
                    onClick={() => setOpen(!open)}
                >
                    {formatValue}
                </TagTrigger>
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
    onSelectChange: onChange,
    isCreate,
}: {
    selectedTags?: string[];
    onSelectChange: (v: string[], extra?: { preferCurrency?: string }) => void;
    isCreate: boolean;
}) {
    const { grouped } = useTag();

    // 统一去重
    const onSelectChange: typeof onChange = useCallback(
        (v: string[], ...args) => onChange(Array.from(new Set(v)), ...args),
        [onChange],
    );

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
