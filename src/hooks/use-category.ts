import { useCallback, useMemo } from "react";
import { useShallow } from "zustand/shallow";
import { BillCategories } from "@/ledger/category";
import { intlCategory, treeCategories } from "@/ledger/utils";
import { useLedgerStore } from "@/store/ledger";
import type { BillCategory } from "@/ledger/type";
import { v4 } from "uuid";
import { useBookStore } from "@/store/book";
import { useIntl } from "@/locale";

export default function useCategory() {
	const t = useIntl();
	const savedCategories = useLedgerStore(
		useShallow((state) => state.infos?.meta.categories),
	);

	const categories = useMemo(
		() => (savedCategories ?? BillCategories).map((v) => intlCategory(v, t)),
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
			prev.categories.push({ ...newData, id });
			resolve(id);
			return prev;
		});
		return promise;
	}, []);

	const update = useCallback(
		async (id: string, value?: Partial<Omit<BillCategory, "id">>) => {
			const book = useBookStore.getState().currentBookId;
			if (!book) {
				return;
			}
			await useLedgerStore.getState().updateGlobalMeta((prev) => {
				if (prev.categories === undefined) {
					prev.categories = BillCategories;
				}
				if (value === undefined) {
					prev.categories = prev.categories.filter((v) => v.id !== id);
					return prev;
				}
				const index = prev.categories.findIndex((v) => v.id === id);
				if (index === -1) {
					return prev;
				}
				prev.categories[index] = { ...prev.categories[index], ...value, id };
				return prev;
			});
		},
		[],
	);

	const reorder = useCallback(async (ordered: Pick<BillCategory, "id">[]) => {
		await useLedgerStore.getState().updateGlobalMeta((prev) => {
			if (prev.categories === undefined) {
				prev.categories = BillCategories;
			}
			const newCategories = ordered.map((t) =>
				prev.categories?.find((v) => v.id === t.id),
			);
			if (newCategories.some((v) => v === undefined)) {
				console.error("category order mismatch", newCategories);
				return prev;
			}
			prev.categories = prev.categories.filter((v) =>
				ordered.every((o) => o.id !== v.id),
			);
			const index = newCategories[0]?.parent
				? prev.categories.findIndex((c) => c.id === newCategories[0]?.parent)
				: 0;

			prev.categories.splice(
				index + 1,
				0,
				...newCategories.filter((v) => v !== undefined),
			);
			return prev;
		});
	}, []);

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
