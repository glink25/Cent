import { Route, Routes } from "react-router";
import Home from "@/pages/home";
import Search from "@/pages/search";
import Stat from "@/pages/stat";
import MainLayout from "./layouts/main-layout";

export default function RootRoute() {
	return (
		<Routes>
			<Route element={<MainLayout />}>
				<Route index element={<Home />} />
				<Route path="/search" element={<Search />} />
				<Route path="/stat/:id?" element={<Stat />} />
			</Route>
		</Routes>
	);
}
