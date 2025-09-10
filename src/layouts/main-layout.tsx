import { Outlet } from "react-router";
import { BillEditorProvider } from "@/components/bill-editor";
import { BillInfoProvider } from "@/components/bill-info";
import Guide from "@/components/guide";
import Login from "@/components/login";
import Navigation from "@/components/navigation";

export default function MainLayout() {
	return (
		<>
			<Navigation />
			<div className="w-full h-full sm:pl-18">
				<Outlet />
			</div>
			<BillEditorProvider />
			<BillInfoProvider />
			<Guide />
			<Login />
		</>
	);
}
