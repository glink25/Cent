import { useEffect, useRef } from "react";
import { Outlet } from "react-router";
import { BillEditorProvider } from "@/components/bill-editor";
import { BillInfoProvider } from "@/components/bill-info";
import { TagListProvider } from "@/components/bill-tag";
import BookGuide from "@/components/book";
import { BookConfirmProvider } from "@/components/book/util";
import { BudgetEditProvider, BudgetProvider } from "@/components/budget";
import { BudgetDetailProvider } from "@/components/budget/detail";
import { CategoryListProvider } from "@/components/category";
import { CurrencyListProvider } from "@/components/currency";
import { ModalProvider } from "@/components/modal";
import Navigation from "@/components/navigation";
import {
    ScheduledEditProvider,
    ScheduledProvider,
} from "@/components/scheduled";
import { Settings } from "@/components/settings";
import { SortableListProvider } from "@/components/sortable";
import { SortableGroupProvider } from "@/components/sortable/group";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useInitPreset } from "@/hooks/use-preset";
import {
    useQuickEntryByClipboard,
    useQuickEntryByRelayr,
    useQuickGoAdd,
} from "@/hooks/use-quick-entry";
import { useScheduled } from "@/hooks/use-scheduled";
import { ThemeProvider } from "@/hooks/use-theme";
import { usePreferenceStore } from "@/store/preference";
import { startBackgroundPredict } from "@/utils/predict";

export default function MainLayout() {
    useQuickGoAdd();
    useQuickEntryByClipboard();
    useQuickEntryByRelayr();

    useEffect(() => {
        // predict
        if (usePreferenceStore.getState().smartPredict) {
            startBackgroundPredict();
        }
    }, []);

    // 自动周期记账
    const { applyScheduled } = useScheduled();
    const applyScheduledRef = useRef(applyScheduled);
    applyScheduledRef.current = applyScheduled;
    useEffect(() => {
        applyScheduledRef.current();
    }, []);

    useInitPreset();

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
                <SortableGroupProvider />
                <Settings />
                <CurrencyListProvider />
                <BookGuide />
                <BookConfirmProvider />
                <BudgetProvider />
                <BudgetEditProvider />
                <BudgetDetailProvider />
                <ScheduledProvider />
                <ScheduledEditProvider />
                <TagListProvider />
                <CategoryListProvider />
                <ModalProvider />
                <Toaster />
            </TooltipProvider>
        </ThemeProvider>
    );
}
