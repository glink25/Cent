/// <reference lib="webworker" />
declare const self: DedicatedWorkerGlobalScope;

import { expose } from "comlink";
import { BillIndexeBDStorage } from "@/gitray";
import { StashBucket } from "@/gitray/stash";
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
			itemStorage.createStorage,
		);
	storeMap.set(storeFullName, { itemStorage, itemBucket });
	return { itemBucket };
};

const filter = async (storeFullName: string, rule: BillFilter) => {
	const items = await getDB(storeFullName).itemBucket.getItems();
	return items.filter((v) => isBillMatched(v, rule));
};

const getInfo = async (storeFullName: string) => {
	const bucket = getDB(storeFullName).itemBucket;
	const globalMeta: GlobalMeta = (await bucket.getMeta()) ?? {};
	return {
		meta: globalMeta,
	};
};

const exposed = {
	init: (v: any) => {},
	getInfo,
	filter,
};

export type Exposed = typeof exposed;

expose(exposed);
