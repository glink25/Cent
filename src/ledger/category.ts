import type { BillCategory } from "./type";

export const ExpenseBillCategories: BillCategory[] = [
	{
		name: "Food",
		id: "food",
		type: "expense",
		icon: "icon-[mdi--food]",
		color: "#5470c6",
	},
	//#region Food
	{
		name: "breakfast",
		id: "breakfast",
		type: "expense",
		icon: "icon-[mdi--bread-slice]",
		color: "#5470c6",
		parent: "food",
	},
	{
		name: "launch",
		id: "launch",
		type: "expense",
		icon: "icon-[mdi--meat]",
		color: "#5470c6",
		parent: "food",
	},
	{
		name: "dinner",
		id: "dinner",
		type: "expense",
		icon: "icon-[mdi--food-turkey]",
		color: "#5470c6",
		parent: "food",
	},
	{
		name: "snack",
		id: "snack",
		type: "expense",
		icon: "icon-[mdi--treat]",
		color: "#5470c6",
		parent: "food",
	},
	{
		name: "treat",
		id: "treat",
		type: "expense",
		icon: "icon-[mdi--food-ramen]",
		color: "#5470c6",
		parent: "food",
	},
	//#endregion Food

	{
		name: "Transport",
		id: "transport",
		type: "expense",
		icon: "icon-[mdi--transportation]",
		color: "#91cc75",
	},
	//#region Transport
	{
		name: "taxi",
		id: "taxi",
		type: "expense",
		icon: "icon-[mdi--taxi]",
		color: "#91cc75",
		parent: "transport",
	},
	{
		name: "subway",
		id: "subway",
		type: "expense",
		icon: "icon-[mdi--subway]",
		color: "#91cc75",
		parent: "transport",
	},
	{
		name: "bus",
		id: "bus",
		type: "expense",
		icon: "icon-[mdi--bus]",
		color: "#91cc75",
		parent: "transport",
	},
	{
		name: "parking",
		id: "parking",
		type: "expense",
		icon: "icon-[mdi--parking]",
		color: "#91cc75",
		parent: "transport",
	},
	{
		name: "gas-up",
		id: "gas-up",
		type: "expense",
		icon: "icon-[mdi--gas-station]",
		color: "#91cc75",
		parent: "transport",
	},
	{
		name: "airplane",
		id: "airplane",
		type: "expense",
		icon: "icon-[mdi--airplane]",
		color: "#91cc75",
		parent: "transport",
	},
	//#endregion Transport

	{
		name: "Shopping",
		id: "shopping",
		type: "expense",
		icon: "icon-[mdi--shopping-cart]",
		color: "#fac858",
	},
	//#region Shopping
	{
		name: "household",
		id: "household",
		type: "expense",
		icon: "icon-[mdi--house-add]",
		color: "#fac858",
		parent: "shopping",
	},
	{
		name: "electronics",
		id: "electronics",
		type: "expense",
		icon: "icon-[mdi--tablet-cellphone]",
		color: "#fac858",
		parent: "shopping",
	},
	{
		name: "credits",
		id: "credits",
		type: "expense",
		icon: "icon-[mdi--bitcoin]",
		color: "#fac858",
		parent: "shopping",
	},
	{
		name: "baby-and-mom",
		id: "baby-mom",
		type: "expense",
		icon: "icon-[mdi--baby-face]",
		color: "#fac858",
		parent: "shopping",
	},
	{
		name: "accessories",
		id: "accessories",
		type: "expense",
		icon: "icon-[mdi--watch]",
		color: "#fac858",
		parent: "shopping",
	},
	{
		name: "clothing",
		id: "clothing",
		type: "expense",
		icon: "icon-[mdi--tshirt-crew]",
		color: "#fac858",
		parent: "shopping",
	},
	{
		name: "pets",
		id: "pets",
		type: "expense",
		icon: "icon-[mdi--pets]",
		color: "#fac858",
		parent: "shopping",
	},
	{
		name: "office",
		id: "office",
		type: "expense",
		icon: "icon-[mdi--briefcase]",
		color: "#fac858",
		parent: "shopping",
	},
	{
		name: "renovation",
		id: "renovation",
		type: "expense",
		icon: "icon-[mdi--house-flood]",
		color: "#fac858",
		parent: "shopping",
	},
	//#endregion Shopping

	{
		name: "Housing",
		id: "housing",
		type: "expense",
		icon: "icon-[mdi--house-city]",
		color: "#ee6666",
	},
	//#region Housing
	{
		name: "phone",
		id: "phone",
		type: "expense",
		icon: "icon-[mdi--phone]",
		color: "#ee6666",
		parent: "housing",
	},
	{
		name: "electricity",
		id: "electricity",
		type: "expense",
		icon: "icon-[mdi--battery-charging-10]",
		color: "#ee6666",
		parent: "housing",
	},
	{
		name: "water",
		id: "water",
		type: "expense",
		icon: "icon-[mdi--water]",
		color: "#ee6666",
		parent: "housing",
	},
	{
		name: "mgmt-fee",
		id: "mgmt-fee",
		type: "expense",
		icon: "icon-[mdi--gardening]",
		color: "#ee6666",
		parent: "housing",
	},
	{
		name: "rent",
		id: "rent",
		type: "expense",
		icon: "icon-[mdi--hoop-house]",
		color: "#ee6666",
		parent: "housing",
	},
	{
		name: "mortgage",
		id: "mortgage",
		type: "expense",
		icon: "icon-[mdi--house-floor-l]",
		color: "#ee6666",
		parent: "housing",
	},
	{
		name: "cleaning",
		id: "cleaning",
		type: "expense",
		icon: "icon-[mdi--vacuum-cleaner]",
		color: "#ee6666",
		parent: "housing",
	},
	//#endregion Housing

	{
		name: "Entertainment",
		id: "entertainment",
		type: "expense",
		icon: "icon-[mdi--google-gamepad]",
		color: "#73c0de",
	},
	//#region Entertainment
	{
		name: "travel",
		id: "travel",
		type: "expense",
		icon: "icon-[mdi--bag-suitcase]",
		color: "#73c0de",
		parent: "entertainment",
	},
	{
		name: "movies",
		id: "movies",
		type: "expense",
		icon: "icon-[mdi--local-movies]",
		color: "#73c0de",
		parent: "entertainment",
	},
	{
		name: "fitness",
		id: "fitness",
		type: "expense",
		icon: "icon-[mdi--fitness-center]",
		color: "#73c0de",
		parent: "entertainment",
	},
	{
		name: "wellness",
		id: "wellness",
		type: "expense",
		icon: "icon-[mdi--emoticon]",
		color: "#73c0de",
		parent: "entertainment",
	},
	{
		name: "drinks",
		id: "drinks",
		type: "expense",
		icon: "icon-[mdi--local-bar]",
		color: "#73c0de",
		parent: "entertainment",
	},
	{
		name: "shows",
		id: "shows",
		type: "expense",
		icon: "icon-[mdi--microphone-variant]",
		color: "#73c0de",
		parent: "entertainment",
	},
	//#endregion Entertainment

	{
		name: "Medical",
		id: "medical",
		type: "expense",
		icon: "icon-[mdi--hospital-box]",
		color: "#3ba272",
	},
	//#region
	{
		name: "clinic",
		id: "clinic",
		type: "expense",
		icon: "icon-[mdi--stethoscope]",
		color: "#3ba272",
		parent: "medical",
	},
	{
		name: "pharmacy",
		id: "pharmacy",
		type: "expense",
		icon: "icon-[mdi--pill-multiple]",
		color: "#3ba272",
		parent: "medical",
	},
	{
		name: "supplements",
		id: "supplements",
		type: "expense",
		icon: "icon-[mdi--account-heart]",
		color: "#3ba272",
		parent: "medical",
	},
	//#endregion

	{
		name: "Education",
		id: "education",
		type: "expense",
		icon: "icon-[mdi--academic-cap]",
		color: "#9a60b4",
	},
	//#region Education
	{
		name: "tuition",
		id: "tuition",
		type: "expense",
		icon: "icon-[mdi--account-school]",
		color: "#9a60b4",
		parent: "education",
	},
	{
		name: "books",
		id: "books",
		type: "expense",
		icon: "icon-[mdi--book-open-blank-variant]",
		color: "#9a60b4",
		parent: "education",
	},
	{
		name: "courses",
		id: "courses",
		type: "expense",
		icon: "icon-[mdi--book-account]",
		color: "#9a60b4",
		parent: "education",
	},
	//#endregion

	{
		name: "social",
		id: "relationship",
		type: "expense",
		icon: "icon-[mdi--party-balloon]",
		color: "#ea7ccc",
	},
	//#region Relationship
	{
		name: "family",
		id: "family",
		type: "expense",
		icon: "icon-[mdi--elderly]",
		color: "#ea7ccc",
		parent: "relationship",
	},
	{
		name: "gifts",
		id: "gifts",
		type: "expense",
		icon: "icon-[mdi--gift]",
		color: "#ea7ccc",
		parent: "relationship",
	},
	{
		name: "loan",
		id: "loan",
		type: "expense",
		icon: "icon-[mdi--hand-back-right]",
		color: "#ea7ccc",
		parent: "relationship",
	},
	{
		name: "hongbao",
		id: "hongbao",
		type: "expense",
		icon: "icon-[mdi--redeem]",
		color: "#ea7ccc",
		parent: "relationship",
	},
	//#endregion

	{
		name: "Other",
		id: "other-expenses",
		type: "expense",
		icon: "icon-[mdi--bookmark-multiple]",
		color: "#4d3c77",
	},
	//#region
	{
		name: "fees-and-charges",
		id: "fees-charges",
		type: "expense",
		icon: "icon-[mdi--cash-minus]",
		color: "#40f8ff",
		parent: "other-expenses",
	},
	{
		name: "charity",
		id: "charity",
		type: "expense",
		icon: "icon-[mdi--charity]",
		color: "#40f8ff",
		parent: "other-expenses",
	},
	{
		name: "reconciliation",
		id: "balance-account",
		type: "expense",
		icon: "icon-[mdi--credit-card-sync-outline]",
		color: "#40f8ff",
		parent: "other-expenses",
	},
	//#endregion
];

export const IncomeBillCategories: BillCategory[] = [
	{
		name: "Wage",
		id: "wage",
		type: "income",
		icon: "icon-[mdi--credit-card-outline]",
		color: "#5470c6",
	},
	//#region Wage
	{
		name: "Part Time",
		id: "part-time",
		type: "income",
		icon: "icon-[mdi--google-cardboard]",
		color: "#91cc75",
		parent: "wage",
	},
	//#endregion Wage

	{
		name: "social",
		id: "relationship-income",
		type: "income",
		icon: "icon-[mdi--party-balloon]",
		color: "#ea7ccc",
	},
	//#region Social
	{
		name: "Lean",
		id: "lean",
		type: "income",
		icon: "icon-[mdi--hand-extended]",
		color: "#fac858",
		parent: "relationship-income",
	},
	{
		name: "gifts",
		id: "gifts-income",
		type: "income",
		icon: "icon-[mdi--gift]",
		color: "#ea7ccc",
		parent: "relationship-income",
	},
	{
		name: "hongbao",
		id: "hongbao-income",
		type: "income",
		icon: "icon-[mdi--redeem]",
		color: "#ea7ccc",
		parent: "relationship-income",
	},
	//#endregion

	{
		name: "Other",
		id: "other-income",
		type: "income",
		icon: "icon-[mdi--bookmark-multiple]",
		color: "#9a60b4",
	},
	//#region Other
	{
		name: "Refund",
		id: "refund",
		type: "income",
		icon: "icon-[mdi--credit-card-refund]",
		color: "#ee6666",
		parent: "other-income",
	},
	{
		name: "Drawback",
		id: "drawback",
		type: "income",
		icon: "icon-[mdi--recurring-payment]",
		color: "#73c0de",
		parent: "other-income",
	},
	{
		name: "reconciliation",
		id: "balance-account-income",
		type: "income",
		icon: "icon-[mdi--credit-card-sync-outline]",
		color: "#40f8ff",
		parent: "other-income",
	},
	//#endregion
];

export const BillCategories: BillCategory[] = [
	...ExpenseBillCategories,
	...IncomeBillCategories,
];

const map = new Map<string, BillCategory>();

export const getDefaultCategoryById = (id: string) => {
	if (map.has(id)) return map.get(id)!;
	const cate = BillCategories.find((c) => c.id === id);
	if (cate) {
		map.set(id, cate);
		return cate;
	}
};
// check id repeat:
// const ids: string[] = [];
// BillCategories.forEach((c) => {
// 	if (ids.includes(c.id)) {
// 		console.log("repeat id:", c.id, c);
// 	} else {
// 		ids.push(c.id);
// 	}
// });
