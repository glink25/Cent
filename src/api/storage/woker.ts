/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { expose } from "comlink";
import { GitrayDB } from "@/gitray";
import type { GitrayDBConfig } from "@/gitray/db";
import { getDefaultCategoryById } from "@/ledger/category";
import type { Bill, BillFilter } from "@/ledger/type";
import { isBillMatched } from "@/ledger/utils";
import type { GlobalMeta, PersonalMeta } from ".";

let gitrayDB: GitrayDB<Bill, { time: number }> | undefined;

const init = (config: GitrayDBConfig) => {
	gitrayDB = new GitrayDB(config);
};

const getDB = () => {
	if (!gitrayDB) {
		throw new Error("gitrayDB not initialized");
	}
	return gitrayDB;
};

const filter = async (storeFullName: string, rule: BillFilter) => {
	const items = await getDB().getAllItems(storeFullName, true, [
		"time",
		"desc",
	]);
	return items.filter((v) => isBillMatched(v, rule));
};

const getInfo = async (storeFullName: string) => {
	const items = await getDB().getAllItems(storeFullName);
	const creatorsSet = new Set<Bill["creatorId"]>();
	const categoryIdsSet = new Set<Bill["categoryId"]>();
	items.forEach((item) => {
		creatorsSet.add(item.creatorId);
		categoryIdsSet.add(item.categoryId);
	});
	const creators = Array.from(creatorsSet);

	const globalMeta: GlobalMeta = await getDB().getMeta(
		storeFullName,
		undefined,
		true,
	);
	const creatorMetas: PersonalMeta[] = await Promise.all(
		creators.map((c) => getDB().getMeta(storeFullName, c, true)),
	);
	return {
		globalMeta,
		creators: creatorMetas.map((meta, i) => ({ id: creators[i], meta })),
		categories: [
			...Array.from(categoryIdsSet)
				.map((id) => getDefaultCategoryById(id))
				.filter((v) => v !== undefined),
			...(globalMeta.customCategories ?? []),
		],
	};
};

const exposed = {
	init,
	getInfo,
	filter,
};

export type Exposed = typeof exposed;

expose(exposed);
