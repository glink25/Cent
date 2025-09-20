/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { expose } from "comlink";
import { BillIndexeBDStorage } from "@/gitray";
import { StashBucket } from "@/gitray/stash";
import { getDefaultCategoryById } from "@/ledger/category";
import type { Bill, BillFilter } from "@/ledger/type";
import { isBillMatched } from "@/ledger/utils";
import type { GlobalMeta } from ".";

const storeMap = new Map<
	string,
	{ itemStorage: BillIndexeBDStorage; itemBucket: StashBucket<Bill> }
>();
const getDB = (storeFullName: string) => {
	const itemStorage =
		storeMap.get(storeFullName)?.itemStorage ??
		new BillIndexeBDStorage(`book-${storeFullName}`);
	const itemBucket =
		storeMap.get(storeFullName)?.itemBucket ??
		new StashBucket(
			itemStorage.createArrayableStorage,
			itemStorage.createStorage
		);
	storeMap.set(storeFullName, { itemStorage, itemBucket });
	return { itemBucket }
};

const filter = async (storeFullName: string, rule: BillFilter) => {
	const items = await getDB(storeFullName).itemBucket.getItems()
	return items.filter((v) => isBillMatched(v, rule));
};

const getInfo = async (storeFullName: string) => {
	const bucket = getDB(storeFullName).itemBucket
	const items = await bucket.getItems()
	const creatorsSet = new Set<Bill["creatorId"]>();
	const categoryIdsSet = new Set<Bill["categoryId"]>();
	items.forEach((item) => {
		creatorsSet.add(item.creatorId);
		categoryIdsSet.add(item.categoryId);
	});
	const creators = Array.from(creatorsSet);

	// const globalMeta: GlobalMeta = await getDB().getMeta(
	// 	storeFullName,
	// 	undefined,
	// 	true,
	// );
	const globalMeta: GlobalMeta = await bucket.getMeta() ?? {}
	return {
		meta: globalMeta,
		creators: creators.map(v => ({ id: v })),
		categories: [
			...Array.from(categoryIdsSet)
				.map((id) => getDefaultCategoryById(id))
				.filter((v) => v !== undefined),
			...(globalMeta.customCategories ?? []),
		],
	};
};

const exposed = {
	init: (v: any) => { },
	getInfo,
	filter,
};

export type Exposed = typeof exposed;

expose(exposed);
