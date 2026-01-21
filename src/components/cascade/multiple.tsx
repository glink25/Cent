/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */

// 为非严格模式，行为如下：
// 1，选中父元素时，依旧会选中全部子元素
// 2，取消选中父元素时，依旧会取消选中全部子元素
// 3，子元素选中变动不再影响父元素的选中，包括在子元素中选择全选

import { ChevronRight } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useIntl } from "@/locale";

type Align = "start" | "center" | "end";

type ListItem = {
    id: string;
    name: string;
    children?: ListItem[];
    asGroupLabel?: string;
};

type Props = {
    list: ListItem[];
    value: string[];
    onValueChange: (value: string[]) => void;
    trigger?: ReactNode;
    align?: Align;
};

// 辅助函数: 递归获取所有后代 ID
const getAllChildIds = (item: ListItem): string[] => {
    let ids: string[] = [];
    if (item.children) {
        for (const child of item.children) {
            ids.push(child.id);
            ids = [...ids, ...getAllChildIds(child)];
        }
    }
    return ids;
};

type BatchChangeFn = (ids: string[], checked: boolean) => void;

const CascaderMenuItem = ({
    item,
    selectedIds,
    onBatchChange,
    align,
}: {
    item: ListItem;
    selectedIds: Set<string>;
    onBatchChange: BatchChangeFn;
    align?: Align;
}) => {
    // 规则 3 落实点：
    // 仅判断自身是否被选中，不再根据子元素计算 indeterminate 状态
    // 也不再因为子元素全满而自动变为 true
    const isSelected = selectedIds.has(item.id);
    const hasChildren = item.children && item.children.length > 0;

    const handleSelect = () => {
        // 规则 1 & 2 落实点：
        // 点击父元素时，获取自身及所有后代 ID，统一设置为当前相反的状态
        const idsToUpdate = [item.id, ...getAllChildIds(item)];
        onBatchChange(idsToUpdate, !isSelected);
    };

    const content = (
        <div className="flex w-full justify-between items-center cursor-pointer">
            <div className="flex-grow pointer-events-none">{item.name}</div>
            {hasChildren && <ChevronRight className="h-4 w-4 ml-auto" />}
        </div>
    );

    if (!hasChildren) {
        return (
            <DropdownMenuItem
                onSelect={(e) => {
                    e.preventDefault();
                    handleSelect();
                }}
            >
                <Checkbox
                    checked={isSelected} // 直接使用 isSelected
                    className="mr-2 pointer-events-none"
                />
                {content}
            </DropdownMenuItem>
        );
    }

    return (
        <DropdownMenu>
            <div className="flex items-center gap-2 w-full rounded-sm px-2 py-1.5 hover:bg-foreground/10 cursor-pointer">
                <Checkbox
                    checked={isSelected} // 直接使用 isSelected
                    className="cursor-pointer"
                    onCheckedChange={() => {
                        console.log("checked change");
                        handleSelect();
                    }}
                />
                <DropdownMenuTrigger asChild>
                    <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        className="flex-grow p-0 !bg-transparent"
                    >
                        {content}
                    </DropdownMenuItem>
                </DropdownMenuTrigger>
            </div>
            <DropdownMenuPortal>
                <DropdownMenuContent
                    align={align}
                    sideOffset={8}
                    alignOffset={-5}
                >
                    <CascaderLevel
                        levelItems={item.children || []}
                        selectedIds={selectedIds}
                        onBatchChange={onBatchChange}
                    />
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
};

const CascaderLevel = ({
    levelItems,
    selectedIds,
    onBatchChange,
    align,
}: {
    levelItems: ListItem[];
    selectedIds: Set<string>;
    onBatchChange: BatchChangeFn;
    align?: Align;
}) => {
    const checkboxRef = useRef<HTMLButtonElement>(null);
    const t = useIntl();

    // 获取当前层级下所有受控的 ID（包括递归子级，用于全选逻辑）
    const levelAllIds = useMemo(
        () =>
            levelItems
                .flatMap((item) =>
                    item.asGroupLabel
                        ? undefined
                        : [item.id, ...getAllChildIds(item)],
                )
                .filter((v) => v !== undefined),
        [levelItems],
    );

    // 计算当前层级是否全选/半选，仅用于控制 "全选" 按钮自身的 UI 显示
    // 这不影响父级菜单的状态
    const selectedInLevelCount = useMemo(
        () => levelAllIds.filter((id) => selectedIds.has(id)).length,
        [levelAllIds, selectedIds],
    );

    const isAllSelected =
        selectedInLevelCount === levelAllIds.length && levelAllIds.length > 0;
    const isPartiallySelected =
        selectedInLevelCount > 0 && selectedInLevelCount < levelAllIds.length;

    useEffect(() => {
        if (checkboxRef.current) {
            checkboxRef.current.setAttribute(
                "data-state",
                isPartiallySelected
                    ? "indeterminate"
                    : isAllSelected
                      ? "checked"
                      : "unchecked",
            );
        }
    }, [isPartiallySelected, isAllSelected]);

    const handleSelectAll = () => {
        // 这里的全选逻辑保持不变：控制当前层级及其下属所有元素
        // 但由于 onBatchChange 逻辑已修改，这里不会向上冒泡影响父级
        const shouldSelectAll = !isAllSelected;
        onBatchChange(levelAllIds, shouldSelectAll);
    };

    return (
        <>
            <DropdownMenuItem
                onSelect={(e) => e.preventDefault()}
                onClick={handleSelectAll}
            >
                <div className="flex items-center w-full cursor-pointer">
                    <Checkbox
                        checked={
                            isPartiallySelected
                                ? "indeterminate"
                                : isAllSelected || isPartiallySelected
                        }
                        id={`select-all-${levelItems[0]?.id}`}
                        className="mr-2 pointer-events-none"
                    />
                    <label
                        htmlFor={`select-all-${levelItems[0]?.id}`}
                        className="w-full pointer-events-none"
                    >
                        {t("select-all")}
                    </label>
                </div>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            {levelItems.map((item) =>
                item.asGroupLabel ? (
                    <DropdownMenuLabel key={item.id}>
                        {item.asGroupLabel}
                    </DropdownMenuLabel>
                ) : (
                    <CascaderMenuItem
                        key={item.id}
                        align={align}
                        item={item}
                        selectedIds={selectedIds}
                        onBatchChange={onBatchChange}
                    />
                ),
            )}
        </>
    );
};

export const CascadeMultipleSelect = ({
    list,
    value,
    onValueChange,
    trigger,
    align,
}: Props) => {
    const selectedIds = useMemo(() => new Set(value), [value]);

    // --------------------------------------------------
    // 核心逻辑修改：非严格模式
    // --------------------------------------------------
    const handleBatchChange: BatchChangeFn = (ids, checked) => {
        const newSelectedIds = new Set(selectedIds);

        if (checked) {
            ids.forEach((id) => newSelectedIds.add(id));
        } else {
            ids.forEach((id) => newSelectedIds.delete(id));
        }

        // 规则 3 落实点：
        // 移除了之前此处存在的 "检查父元素子集是否全选/全不选以同步更新父元素 ID" 的逻辑。
        // 现在 ID 的变动完全由用户的点击行为决定，不做自动推导。

        onValueChange(Array.from(newSelectedIds));
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {trigger || <Button variant="outline">Please select</Button>}
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent align={align} className="w-48">
                    <CascaderLevel
                        align={align}
                        levelItems={list}
                        selectedIds={selectedIds}
                        onBatchChange={handleBatchChange}
                    />
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
};
