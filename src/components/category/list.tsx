import useCategory from "@/hooks/use-category";
import PopupLayout from "@/layouts/popup-layout";
import { useIntl } from "@/locale";
import { Button } from "../ui/button";
import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { categoriesGridClassName, treeCategories } from "@/ledger/utils";
import { Collapsible } from "radix-ui";
import type { BillCategory } from "@/ledger/type";
import { CategoryEditFormProvider, showCategoryEdit } from "./form";
import { CategoryItem } from "./item";
import { cn } from "@/utils";

export default function CategoryList({
	onCancel,
}: {
	edit?: any;
	onCancel?: () => void;
	onConfirm?: (v: any) => void;
}) {
	const t = useIntl();
	const { categories } = useCategory();

	const expenses = treeCategories(
		categories.filter((v) => v.type === "expense"),
	);
	const incomes = treeCategories(categories.filter((v) => v.type === "income"));
	const tabs = [
		{ label: "expense", value: expenses },
		{ label: "income", value: incomes },
	];
	const toAddChildCategory = (parentId: string) => {
		showCategoryEdit({
			id: undefined,
			parent: parentId,
			type: categories.find((c) => c.id === parentId)!.type,
		});
	};

	const toAddCategory = async () => {
		showCategoryEdit();
	};

	const toEditCategory = async (cate: BillCategory) => {
		await showCategoryEdit(cate);
	};
	return (
		<PopupLayout
			className="overflow-hidden h-full"
			onBack={onCancel}
			title={t("edit-categories")}
		>
			<Tabs
				defaultValue="expense"
				className="px-2 pb-4 flex flex-col flex-1 overflow-hidden gap-2"
			>
				<div className="w-full flex justify-center">
					<div>
						<TabsList>
							{tabs.map((tab) => (
								<TabsTrigger key={tab.label} value={tab.label}>
									{t(tab.label)}
								</TabsTrigger>
							))}
						</TabsList>
					</div>
				</div>
				<p className="px-2 text-xs text-foreground/80">
					{t("click-category-to-edit")}
				</p>
				{tabs.map((v) => (
					<TabsContent
						key={v.label}
						value={v.label}
						className="flex-1 overflow-y-auto scrollbar-hidden flex flex-col gap-4"
					>
						<Button variant="outline">
							<i className="icon-[mdi--plus]"></i>
							{t("add-new-category-group")}
						</Button>
						{v.value.map((parent, i) => {
							return (
								<Collapsible.Root
									key={parent.id}
									defaultOpen={i === 0}
									className="rounded-md border shadow group"
								>
									<Collapsible.Trigger asChild>
										<div className="px-2 py-1 flex items-center justify-between">
											<div>
												<CategoryItem
													category={parent}
													onClick={(e) => {
														e.stopPropagation();
														e.preventDefault();
														toEditCategory(parent);
													}}
												/>
											</div>
											<i className=" group-[[data-state=open]]:icon-[mdi--chevron-down] group-[[data-state=closed]]:icon-[mdi--chevron-up]" />
										</div>
									</Collapsible.Trigger>
									<Collapsible.Content className="border-t data-[state=open]:animate-collapse-open data-[state=closed]:animate-collapse-close data-[state=closed]:overflow-hidden">
										<div
											className={cn(
												"p-4 grid gap-1 text-sm",
												categoriesGridClassName(parent.children),
											)}
										>
											{parent.children.map((child) => {
												return (
													<CategoryItem
														key={child.id}
														category={child}
														onClick={() => toEditCategory(child)}
													/>
												);
											})}
											<button
												type="button"
												className="rounded-lg border flex justify-center items-center"
												onClick={() => toAddChildCategory(parent.id)}
											>
												<i className="icon-[mdi--plus]"></i>
												{t("add")}
											</button>
										</div>
									</Collapsible.Content>
								</Collapsible.Root>
							);
						})}
					</TabsContent>
				))}
			</Tabs>
			<CategoryEditFormProvider />
		</PopupLayout>
	);
}
