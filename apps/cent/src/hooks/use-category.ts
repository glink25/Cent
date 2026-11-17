import { useCallback, useMemo } from "react";
import { v4 } from "uuid";
import { assertEditable } from "@/components/widget/core/computed";
import { BillCategories } from "@/ledger/category";
import type { BillCategory } from "@/ledger/type";
import { intlCategory, treeCategories } from "@/ledger/utils";
import { useIntl } from "@/locale";
import { measure } from "@/measurement";
import { useBookStore } from "@/store/book";
import { useLedgerStore } from "@/store/ledger";
import { useWidgetMeta } from "./use-widget-meta";

/** 确保收入和支持的分类至少有一个 */
const validateCategories = (categories: BillCategory[]) => {
    const isValid = categories.reduce(
        (prev, category) => {
            if (category.type === "income") {
                prev.income = true;
            } else {
                prev.expense = true;
            }
            return prev;
        },
        { expense: false, income: false },
    );
    if (isValid.income === false || isValid.expense === false) {
        return false;
    }
    return true;
};

export default function useCategory() {
    const t = useIntl();
    const { categories: savedCategories } = useWidgetMeta();

    const categories = useMemo(
        () =>
            (savedCategories ?? BillCategories).map((v) => intlCategory(v, t)),
        [savedCategories, t],
    );

    const incomes = useMemo(
        () => treeCategories(categories.filter((v) => v.type === "income")),
        [categories],
    );
    const expenses = useMemo(
        () => treeCategories(categories.filter((v) => v.type === "expense")),
        [categories],
    );

    const add = useCallback(async (newData: Omit<BillCategory, "id">) => {
        const book = useBookStore.getState().currentBookId;
        if (!book) {
            return;
        }
        const { promise, resolve, reject } = Promise.withResolvers<string>();
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            if (prev.categories === undefined) {
                prev.categories = BillCategories;
            }
            const id = v4();
            prev.categories.push({ ...newData, customName: true, id });
            resolve(id);
            return prev;
        });
        measure("feature_config_changed", {
            feature: "category",
            action: "create",
        });
        return promise;
    }, []);

    const update = useCallback(
        async (id: string, value?: Partial<Omit<BillCategory, "id">>) => {
            assertEditable(id);
            const book = useBookStore.getState().currentBookId;
            if (!book) {
                return;
            }
            await useLedgerStore.getState().updateGlobalMeta((prev) => {
                if (prev.categories === undefined) {
                    prev.categories = BillCategories;
                }
                if (value === undefined) {
                    prev.categories = prev.categories.filter(
                        (v) => v.id !== id,
                    );
                    const valid = validateCategories(prev.categories);
                    if (!valid) {
                        throw new Error(
                            "each bill-type must has one category as least",
                        );
                    }
                    return prev;
                }
                const index = prev.categories.findIndex((v) => v.id === id);
                if (index === -1) {
                    return prev;
                }
                // 如果是默认分类，并且名称与intl后的名称不同，customName设为true，否则为undefined
                // 如果是用户自建分类（不在 BillCategories 里），保留原有的 customName（true）
                const existingCategory = prev.categories[index];
                let customName: boolean | undefined =
                    existingCategory.customName;
                const defaultCategory = BillCategories.find((c) => c.id === id);
                if (defaultCategory) {
                    customName = t(defaultCategory.name) !== value.name;
                }
                prev.categories[index] = {
                    ...prev.categories[index],
                    ...value,
                    customName,
                    name:
                        customName === true
                            ? value.name!
                            : (defaultCategory?.name ?? value.name!),
                    id,
                };
                return prev;
            });
            measure("feature_config_changed", {
                feature: "category",
                action: value === undefined ? "delete" : "update",
            });
        },
        [t],
    );

    const reorder = useCallback(
        async (ordered: readonly Pick<BillCategory, "id">[]) => {
            const savedOrder = ordered.filter(
                (item) => !item.id.startsWith("wc-"),
            );
            if (!savedOrder.length) return;
            await useLedgerStore.getState().updateGlobalMeta((prev) => {
                const categories = prev.categories ?? BillCategories;
                const newCategories = savedOrder.map((item) =>
                    categories.find((category) => category.id === item.id),
                );
                if (!newCategories.every((item) => item !== undefined)) {
                    console.error("category order mismatch", newCategories);
                    return prev;
                }
                const remaining = categories.filter((category) =>
                    savedOrder.every((item) => item.id !== category.id),
                );
                const parent = newCategories[0]?.parent;
                const index = parent
                    ? remaining.findIndex((category) => category.id === parent)
                    : 0;
                return {
                    ...prev,
                    categories: [
                        ...remaining.slice(0, index + 1),
                        ...newCategories,
                        ...remaining.slice(index + 1),
                    ],
                };
            });
        },
        [],
    );

    const reset = useCallback(async () => {
        const allBills = await useLedgerStore.getState().refreshBillList();
        const safeToReset = allBills.every((b) =>
            BillCategories.some((c) => c.id === b.categoryId),
        );
        if (!safeToReset) {
            throw new Error("still has transactions with custom category");
        }
        await useLedgerStore.getState().updateGlobalMeta((prev) => {
            prev.categories = undefined;
            return prev;
        });
        measure("feature_config_changed", {
            feature: "category",
            action: "reset",
        });
    }, []);

    return {
        categories,
        incomes,
        expenses,

        update,
        add,
        reorder,
        reset,
    };
}
