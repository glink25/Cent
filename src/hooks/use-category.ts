import { BillCategories } from "@/ledger/category";
import { treeCategories } from "@/ledger/utils";
import { useLedgerStore } from "@/store/ledger";
import { useMemo } from "react";
import { useShallow } from "zustand/shallow";

export default function useCategory() {
	const savedCategories = useLedgerStore(
		useShallow((state) => state.infos?.meta.categories),
	);

	const categories = savedCategories ?? BillCategories;

	const incomes = useMemo(
		() => treeCategories(categories.filter((v) => v.type === "income")),
		[categories],
	);
	const expenses = useMemo(
		() => treeCategories(categories.filter((v) => v.type === "expense")),
		[categories],
	);

	return {
		categories,
		incomes,
		expenses,
	};
}
