import { Outlet } from "react-router";
import { BillEditorProvider } from "@/components/bill-editor";
import { BillInfoProvider } from "@/components/bill-info";
import BookGuide from "@/components/book";
import { BudgetEditProvider, BudgetProvider } from "@/components/budget";
import { CategoryListProvider } from "@/components/category";
import Login from "@/components/login";
import Navigation from "@/components/navigation";
import { Settings } from "@/components/settings";
import { Toaster } from "@/components/ui/sonner";
import { TagListProvider } from "@/components/bill-tag";

export default function MainLayout() {
	return (
		<>
			<Navigation />
			<div className="w-full h-full sm:pl-18">
				<Outlet />
			</div>
			<BillEditorProvider />
			<BillInfoProvider />
			<Settings />
			<BookGuide />
			<BudgetProvider />
			<BudgetEditProvider />
			<TagListProvider />
			<CategoryListProvider />
			<Login />
			<Toaster />
		</>
	);
}
