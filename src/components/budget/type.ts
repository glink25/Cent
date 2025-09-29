export type Budget = {
	id: string;
	title: string;
	start: number;
	end?: number;
	repeat: {
		unit: "week" | "day" | "month" | "year";
		value: number;
	};
	joiners: (string | number)[];
	totalBudget: number;
	categoriesBudget?: {
		id: string;
		budget: number;
	}[];
	onlyTags?: string[];
	excludeTags?: string[];
};

export type EditBudget = Omit<Budget, "id"> & { id?: string };
