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
	comment: string;
	/** 整数金额，10000:1 */
	amount: Amount;
	createAt: number;
	updateAt?: number;
	image?: File | string;
	location?: string;
	tags?: string[];
};
