import { useCallback } from "react";
import { Outlet } from "react-router";
import { BillEditorProvider, goAddBill } from "@/components/bill-editor";
import { BillInfoProvider } from "@/components/bill-info";
import { TagListProvider } from "@/components/bill-tag";
import BookGuide from "@/components/book";
import { BudgetEditProvider, BudgetProvider } from "@/components/budget";
import { BudgetDetailProvider } from "@/components/budget/detail";
import { CategoryListProvider } from "@/components/category";
import { CurrencyListProvider } from "@/components/currency";
import { ModalProvider } from "@/components/modal";
import Navigation from "@/components/navigation";
import { afterAddBillPromotion } from "@/components/promotion";
import { Settings } from "@/components/settings";
import { SortableListProvider } from "@/components/sortable";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import useRapidReducedMotionChange from "@/hooks/use-reduce-motion";
import { ThemeProvider } from "@/hooks/use-theme";
import { usePreferenceStore } from "@/store/preference";

export default function MainLayout() {
    useRapidReducedMotionChange(
        useCallback(() => {
            goAddBill();
            afterAddBillPromotion();
        }, []),
        {
            disable:
                !usePreferenceStore.getState()
                    .enterAddBillWhenReduceMotionChanged,
        },
    );
    return (
        <ThemeProvider>
            <TooltipProvider>
                <Navigation />
                <div className="w-full h-full sm:pl-18">
                    <Outlet />
                </div>
                <BillEditorProvider />
                <BillInfoProvider />
                <SortableListProvider />
                <Settings />
                <CurrencyListProvider />
                <BookGuide />
                <BudgetProvider />
                <BudgetEditProvider />
                <BudgetDetailProvider />
                <TagListProvider />
                <CategoryListProvider />
                <ModalProvider />
                <Toaster />
            </TooltipProvider>
        </ThemeProvider>
    );
}
