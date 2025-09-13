export type BillType = "income" | "expense";

export type Amount = number;

export type BillCategory = {
	type: BillType;
	name: string;
	id: string;
	icon: string;
	color: string;
	pieColor: string;
};

export type Bill = {
	id: string;
	type: BillType;
	categoryId: string;
	creatorId: number | string;
	comment?: string;
	/** 整数金额，10000:1 */
	amount: Amount;
	time: number;
	// _created_at: number;
	// _updated_at: number;
	image?: File | string;
	location?: string;
	tags?: string[];
};

export type BillFilter = Partial<{
	comment: string;
	start: number;
	end: number;
	type: BillType | undefined;
	creators: (string | number)[];
	categories: string[]
	minAmount: number;
	maxAmount: number;
}>
