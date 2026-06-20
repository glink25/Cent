import { Suspense } from "react";
import { MemoryRouter, Route, Routes } from "react-router";
import Home from "@/pages/home";
import { LoadingSkeleton } from "./components/loading";
import MainLayout from "./layouts/main-layout";
import { useLedgerStore } from "./store/ledger";
import { lazyWithReload } from "./utils/lazy";

const Stat = lazyWithReload(
    async () => {
        return import("@/pages/stat");
    },
    async () => {
        // 加载stat页面前需要获取全部账单数据
        await useLedgerStore.getState().refreshBillList();
    },
);

const Search = lazyWithReload(() => import("@/pages/search"));

function RootRoute() {
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

export default function Rooot() {
    return (
        <MemoryRouter>
            <RootRoute />
        </MemoryRouter>
    );
}
