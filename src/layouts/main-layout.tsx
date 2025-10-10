import { useCallback } from "react";
import { Outlet } from "react-router";
import { BillEditorProvider, goAddBill } from "@/components/bill-editor";
import { BillInfoProvider } from "@/components/bill-info";
import { TagListProvider } from "@/components/bill-tag";
import BookGuide from "@/components/book";
import { BudgetEditProvider, BudgetProvider } from "@/components/budget";
import { BudgetDetailProvider } from "@/components/budget/detail";
import { CategoryListProvider } from "@/components/category";
import Login from "@/components/login";
import Navigation from "@/components/navigation";
import { Settings } from "@/components/settings";
import { SortableListProvider } from "@/components/sortable";
import { Toaster } from "@/components/ui/sonner";
import useRapidReducedMotionChange from "@/hooks/use-reduce-motion";
import { usePreferenceStore } from "@/store/preference";

export default function MainLayout() {
	useRapidReducedMotionChange(
		useCallback(() => {
			goAddBill();
		}, []),
		{
			disable:
				!usePreferenceStore.getState().enterAddBillWhenReduceMotionChanged,
		},
	);
	return (
		<>
			<Navigation />
			<div className="w-full h-full sm:pl-18">
				<Outlet />
			</div>
			<BillEditorProvider />
			<BillInfoProvider />
			<SortableListProvider />
			<Settings />
			<BookGuide />
			<BudgetProvider />
			<BudgetEditProvider />
			<BudgetDetailProvider />
			<TagListProvider />
			<CategoryListProvider />
			<Login />
			<Toaster />
		</>
	);
}
