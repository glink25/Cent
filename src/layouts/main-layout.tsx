import { Outlet } from "react-router";
import { BillEditorProvider } from "@/components/bill-editor";
import { BillInfoProvider } from "@/components/bill-info";
import BookGuide from "@/components/book";
import Login from "@/components/login";
import Navigation from "@/components/navigation";
import { Settings } from "@/components/settings";
import { Toaster } from "@/components/ui/sonner";

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
			<Login />
			<Toaster />
		</>
	);
}
