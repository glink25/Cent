import type { BillCategory } from "./type";

export const ExpenseBillCategories: BillCategory[] = [
	{
		name: "Food",
		id: "food",
		type: "expense",
		icon: "icon-[mdi--food]",
		color: "bg-red-600",
		pieColor: "#5470c6",
	},
	{
		name: "Transport",
		id: "transport",
		type: "expense",
		icon: "icon-[mdi--airplane]",
		color: "bg-red-600",
		pieColor: "#91cc75",
	},
	{
		name: "Shopping",
		id: "shopping",
		type: "expense",
		icon: "icon-[mdi--shopping-cart]",
		color: "bg-red-600",
		pieColor: "#fac858",
	},
	{
		name: "Housing",
		id: "housing",
		type: "expense",
		icon: "icon-[mdi--house-city]",
		color: "bg-red-600",
		pieColor: "#ee6666",
	},
	{
		name: "Entertainment",
		id: "entertainment",
		type: "expense",
		icon: "icon-[mdi--google-gamepad]",
		color: "bg-red-600",
		pieColor: "#73c0de",
	},
	{
		name: "Medical",
		id: "medical",
		type: "expense",
		icon: "icon-[mdi--pill-multiple]",
		color: "bg-red-600",
		pieColor: "#3ba272",
	},
	{
		name: "Education",
		id: "education",
		type: "expense",
		icon: "icon-[mdi--academic-cap]",
		color: "bg-red-600",
		pieColor: "#9a60b4",
	},
	{
		name: "Relationship",
		id: "relationship",
		type: "expense",
		icon: "icon-[mdi--gift]",
		color: "bg-red-600",
		pieColor: "#ea7ccc",
	},
	{
		name: "Balance Account",
		id: "balance-account",
		type: "expense",
		icon: "icon-[mdi--credit-card-sync-outline]",
		color: "bg-red-600",
		pieColor: "#40f8ff",
	},
	{
		name: "Other",
		id: "other-expenses",
		type: "expense",
		icon: "icon-[mdi--bookmark-multiple]",
		color: "bg-red-600",
		pieColor: "#4d3c77",
	},
];

export const IncomeBillCategories: BillCategory[] = [
	{
		name: "Wage",
		id: "wage",
		type: "income",
		icon: "icon-credit-card",
		color: "bg-red-600",
		pieColor: "#5470c6",
	},
	{
		name: "Part Time",
		id: "part-time",
		type: "income",
		icon: "icon-community",
		color: "bg-red-600",
		pieColor: "#91cc75",
	},
	{
		name: "Lean",
		id: "lean",
		type: "income",
		icon: "icon-mail-open",
		color: "bg-red-600",
		pieColor: "#fac858",
	},
	{
		name: "Refund",
		id: "refund",
		type: "income",
		icon: "icon-arrow-bottom-right",
		color: "bg-red-600",
		pieColor: "#ee6666",
	},
	{
		name: "Drawback",
		id: "drawback",
		type: "income",
		icon: "icon-pentagon-right",
		color: "bg-red-600",
		pieColor: "#73c0de",
	},
	{
		name: "Balance Account",
		id: "balance-account",
		type: "income",
		icon: "icon-ruler",
		color: "bg-red-600",
		pieColor: "#3ba272",
	},
	{
		name: "Other",
		id: "other-income",
		type: "income",
		icon: "icon-bookmark",
		color: "bg-red-600",
		pieColor: "#9a60b4",
	},
];

export const BillCategories: BillCategory[] = [
	...ExpenseBillCategories,
	...IncomeBillCategories,
];

const map = new Map<string, BillCategory>();

export const getCategoryById = (id: string) => {
	if (map.has(id)) return map.get(id)!;
	const cate = BillCategories.find((c) => c.id === id);
	if (cate) {
		map.set(id, cate);
		return cate;
	}
};
