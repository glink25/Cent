/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */

import { Check, ChevronRight } from "lucide-react"; // 引入 Check 图标
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// 类型定义 (基本不变)
type Align = "start" | "center" | "end";
type ListItem = {
    id: string;
    name: string;
    children?: ListItem[];
    asGroupLabel?: string;
};

// Props 定义已更新为单选模式
type Props = {
    list: ListItem[];
    /** 当前选中的值的 ID */
    value: string | undefined;
    /** 值改变时的回调函数 */
    onValueChange: (value: string | undefined) => void;
    /** 自定义触发器 */
    trigger?: ReactNode;
    /** 菜单对齐方式 */
    align?: Align;
    /** 未选择任何值时的占位符 */
    placeholder?: string;
};

/**
 * 渲染单个菜单项或子菜单触发器 (已修正父节点选择事件)
 */
const CascaderMenuItem = ({
    item,
    selectedValue,
    onValueChange,
    align,
}: {
    item: ListItem;
    selectedValue: string | undefined;
    onValueChange: (value: string | undefined) => void;
    align?: Align;
}) => {
    const isSelected = item.id === selectedValue;
    const hasChildren = item.children && item.children.length > 0;

    // 叶子节点的逻辑保持不变
    if (!hasChildren) {
        return (
            <DropdownMenuItem
                className="flex justify-between items-center"
                onSelect={() => onValueChange(item.id)}
            >
                <span>{item.name}</span>
                {isSelected && <Check className="h-4 w-4" />}
            </DropdownMenuItem>
        );
    }

    // --- vvvvvv 修正点在这里 vvvvvv ---
    // 父节点的逻辑
    return (
        <DropdownMenu>
            <DropdownMenuItem
                className="flex justify-between items-center"
                onClick={() => {
                    onValueChange(item.id);
                }}
            >
                <span>{item.name}</span>
                <div className="flex items-center">
                    {isSelected && <Check className="h-4 w-4 mr-2" />}
                    <DropdownMenuTrigger asChild>
                        <ChevronRight className="h-4 w-4" />
                    </DropdownMenuTrigger>
                </div>
            </DropdownMenuItem>

            <DropdownMenuPortal>
                <DropdownMenuContent
                    align={align}
                    sideOffset={8}
                    alignOffset={-5}
                >
                    <CascaderLevel
                        levelItems={item.children || []}
                        selectedValue={selectedValue}
                        onValueChange={onValueChange}
                        align={align}
                    />
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
};
/**
 * 渲染一个级别的菜单列表
 */
const CascaderLevel = ({
    levelItems,
    selectedValue,
    onValueChange,
    align,
}: {
    levelItems: ListItem[];
    selectedValue: string | undefined;
    onValueChange: (value: string | undefined) => void;
    align?: Align;
}) => {
    return (
        <>
            {levelItems.map((item) =>
                item.asGroupLabel ? (
                    <DropdownMenuLabel key={item.id}>
                        {item.asGroupLabel}
                    </DropdownMenuLabel>
                ) : (
                    <CascaderMenuItem
                        key={item.id}
                        item={item}
                        selectedValue={selectedValue}
                        onValueChange={onValueChange}
                        align={align}
                    />
                ),
            )}
        </>
    );
};

// 辅助函数: 递归查找指定ID的项
const findItemById = (items: ListItem[], id: string): ListItem | null => {
    for (const item of items) {
        if (item.id === id) {
            return item;
        }
        if (item.children) {
            const found = findItemById(item.children, id);
            if (found) {
                return found;
            }
        }
    }
    return null;
};

/**
 * 单选级联选择组件
 */
export const SingleCascadeSelect = ({
    list,
    value,
    onValueChange,
    trigger,
    align,
    placeholder = "Please select",
}: Props) => {
    // 根据当前选中的 value(id) 查找对应的名称，用于显示在按钮上
    const selectedItemName = findItemById(list, value || "")?.name;

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                {trigger || (
                    <Button variant="outline" className={"w-fit justify-start"}>
                        {selectedItemName || placeholder}
                    </Button>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuPortal>
                <DropdownMenuContent align={align} className="w-48">
                    <CascaderLevel
                        levelItems={list}
                        selectedValue={value}
                        onValueChange={onValueChange}
                        align={align}
                    />
                </DropdownMenuContent>
            </DropdownMenuPortal>
        </DropdownMenu>
    );
};
