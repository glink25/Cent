import { Route, Routes } from "react-router";
import Home from "@/pages/home";
import MainLayout from "./layouts/main-layout";
import { lazy, Suspense } from "react";
import { LoadingSkeleton } from "./components/loading";

const Stat = lazy(() => import("@/pages/stat"));

const Search = lazy(() => import("@/pages/search"));

export default function RootRoute() {
	return (
		<Routes>
			<Route element={<MainLayout />}>
				<Route index element={<Home />} />
				<Route
					path="/search"
					element={
						<Suspense fallback={<LoadingSkeleton />}>
							<Search />
						</Suspense>
					}
				/>
				<Route
					path="/stat/:id?"
					element={
						<Suspense fallback={<LoadingSkeleton />}>
							<Stat />
						</Suspense>
					}
				/>
			</Route>
		</Routes>
	);
}
