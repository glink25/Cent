/** biome-ignore-all lint/a11y/useKeyWithClickEvents: <explanation> */
/** biome-ignore-all lint/a11y/noStaticElementInteractions: <explanation> */
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
	DropdownMenuSeparator,
	DropdownMenuLabel,
	DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronRight } from "lucide-react";
import { type ReactNode, useRef, useMemo, useEffect } from "react";

type Align = "start" | "center" | "end";
// 类型定义 (保持不变)
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

// 辅助函数: 递归获取所有后代 ID (保持不变)
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

// --------------------------------------------------
// 优化点 1: 批量更新函数类型
// --------------------------------------------------
// 不再是 (id, checked)，而是 (ids, checked)
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
	const isSelected = selectedIds.has(item.id);
	const hasChildren = item.children && item.children.length > 0;

	const handleSelect = () => {
		// --------------------------------------------------
		// 优化点 2: 总是计算自身和所有后代的 ID
		// --------------------------------------------------
		// 然后将它们作为一个整体进行批量更新
		const idsToUpdate = [item.id, ...getAllChildIds(item)];
		onBatchChange(idsToUpdate, !isSelected);
	};

	const content = (
		<div className="flex items-center w-full" onClick={handleSelect}>
			<Checkbox
				id={`checkbox-${item.id}`}
				checked={isSelected}
				className="mr-2 pointer-events-none" // checkbox 本身不响应点击，由父 div 处理
			/>
			<label
				htmlFor={`checkbox-${item.id}`}
				className="flex-grow cursor-pointer"
			>
				{item.name}
			</label>
			{hasChildren && <ChevronRight className="h-4 w-4 ml-auto" />}
		</div>
	);

	if (!hasChildren) {
		return (
			<DropdownMenuItem onSelect={(e) => e.preventDefault()}>
				{content}
			</DropdownMenuItem>
		);
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<DropdownMenuItem
					onSelect={(e) => e.preventDefault()}
					className="justify-between"
				>
					{content}
				</DropdownMenuItem>
			</DropdownMenuTrigger>
			<DropdownMenuPortal>
				<DropdownMenuContent align={align} sideOffset={8} alignOffset={-5}>
					<CascaderLevel
						levelItems={item.children || []}
						selectedIds={selectedIds}
						onBatchChange={onBatchChange} // 传递批量更新函数
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

	const levelAllIds = useMemo(
		() =>
			levelItems
				.flatMap((item) =>
					item.asGroupLabel ? undefined : [item.id, ...getAllChildIds(item)],
				)
				.filter((v) => v !== undefined),
		[levelItems],
	);

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
		// --------------------------------------------------
		// 优化点 3: 全选事件也调用批量更新
		// --------------------------------------------------
		// 如果已经是全选，则全部取消；否则，全部选中。
		const shouldSelectAll = !isAllSelected;
		onBatchChange(levelAllIds, shouldSelectAll);
	};

	return (
		<>
			<DropdownMenuItem
				onSelect={(e) => e.preventDefault()}
				onClick={handleSelectAll}
			>
				<div className="flex items-center w-full">
					<Checkbox
						checked={
							isPartiallySelected
								? "indeterminate"
								: isAllSelected || isPartiallySelected
						}
						id={`select-all-${levelItems[0]?.id}`}
						className="mr-2 pointer-events-none" // checkbox 本身不响应点击
					/>
					<label
						htmlFor={`select-all-${levelItems[0]?.id}`}
						className="w-full cursor-pointer"
					>
						全选
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
						onBatchChange={onBatchChange} // 传递批量更新函数
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
	// 优化点 4: 核心批量处理逻辑
	// --------------------------------------------------
	// 这个函数负责接收一批ID，一次性地更新状态，并且只调用 onValueChange 一次。
	const handleBatchChange: BatchChangeFn = (ids, checked) => {
		// 复制当前的 Set，避免直接修改 state
		const newSelectedIds = new Set(selectedIds);

		if (checked) {
			ids.forEach((id) => newSelectedIds.add(id));
		} else {
			ids.forEach((id) => newSelectedIds.delete(id));
		}

		// 最后，将新的 Set 转换为数组，并调用一次 onValueChange
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
						onBatchChange={handleBatchChange} // 将批量更新函数传递下去
					/>
				</DropdownMenuContent>
			</DropdownMenuPortal>
		</DropdownMenu>
	);
};
